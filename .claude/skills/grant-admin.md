---
name: grant-admin
description: Grant platform-admin (system-wide admin role) to a user by their email. Use when bootstrapping the first admin without relying on the first-user-is-admin auto-bootstrap, recovering admin access after all admins got removed, or seeding test data. The user must have signed in at least once via OAuth so their record exists in `finances_auth.users`. Emits an `AdminGranted` event through the platform-role aggregate so the grant lands in the audit trail like any other admin action.
---

# grant-admin

Bootstrap or grant the platform-admin role to a user by email. This is the manual escape hatch around the normal first-user-is-admin auto-bootstrap and the in-app `/admin/users` UI's "Grant admin" button.

## When to use

- **No admins exist yet** and you want a specific person (not necessarily the first signer-in) to be the bootstrap admin.
- **All admins were removed** by mistake — the in-app UI's "Grant admin" button is gated by `requireAdmin()`, so you can't use it to recover.
- **Seeding test data** in a fresh database.

The normal path is *not* this script:
- First signup → first-user-is-admin auto-grant fires in `events.signIn`.
- Subsequent admins → existing admin clicks "Grant admin" on `/admin/users`.

## Prerequisites

- Mongo replica set is up (`pnpm infra:up` from monorepo root).
- The target user has signed in at least once. The script finds them by email in `finances_auth.users`; if they've never signed in there's no record to grant against.
- `.env.local` is populated (at minimum `AUTH_MONGO_URI` or `FINANCES_MONGO_URI` if you've overridden the defaults; `AUTH_SECRET` for the cryptoshredding key-store).

## How to run

```bash
# From inside examples/example-finances/
pnpm admin:grant user@example.com

# Or from the monorepo root
pnpm --filter example-finances admin:grant user@example.com
```

The script:
1. Lowercases the email argument.
2. Looks up `finances_auth.users` for `{ email: '<lowercased>' }`.
3. Resolves the `_id` (Auth.js user id, which is the framework's `userId`).
4. Publishes an `AdminGranted` event via the platform-role aggregate (stream `platform-role-{userId}`) with:
   - `grantedByUserId: 'cli-bootstrap'` — literal sentinel string. Distinguishes CLI grants from UI grants in the audit log.
   - `reason: 'Granted via grant-admin script'`.
5. Prints the success line including the resolved userId.

The grant is event-sourced like every other admin action — `admin-activity` read model picks it up and it'll appear in `/admin/audit-log`.

## Idempotency

Running twice for the same email is safe. The platform-role aggregate's `grantAdmin` command short-circuits when the target is already admin (no-op + warn) — the second run prints a "user is already admin" notice and exits 0.

## Outcomes

| Outcome | What you see | What to do |
|---|---|---|
| Granted successfully | `✓ Granted platform-admin to user@example.com (userId=…). They will be admin on their next request.` | Tell the user to refresh; their next session callback picks up `isAdmin: true`. |
| Already admin | `· user@example.com is already platform-admin (userId=…). No change.` | Nothing — idempotent. |
| User not signed in yet | exit 1; `✗ No user found for user@example.com in finances_auth.users. They must sign in once via OAuth before you can grant admin.` | Ask the user to sign in once (`pnpm dev` running, `/auth/signin`), then re-run this script. |
| Mongo unreachable | `✗ MongoServerSelectionError: …` | `pnpm infra:up` from monorepo root; wait ~30s for replica set election; retry. |
| `AUTH_SECRET` not set | `✗ AUTH_SECRET must be set for cryptoshredding key-store` | Generate one: `openssl rand -base64 33` → drop into `.env.local`. |

## Companion: removing admin via CLI

The reverse operation (`removeAdmin`) isn't exposed as a separate script intentionally — once admins exist, use the `/admin/users` "Remove admin" button (which goes through the same anti-self-lockout guard the framework enforces). If you need to remove the LAST admin and re-grant a different one, run `grant-admin` for the new email first, then sign in as the new admin and use the UI to demote the old one.

## Where the audit lives

Every grant via this script is durable:
- **Stream**: `platform-role-{targetUserId}` (per-user role-history stream)
- **Event**: `AdminGranted` with `grantedByUserId: 'cli-bootstrap'`
- **Read model**: `platform-roles` (queryable in-app)
- **Audit log**: `admin-activity` read model → `/admin/audit-log` page (under "Grants & revocations" once you scroll past impersonation events)

The CLI-source marker (`grantedByUserId: 'cli-bootstrap'`) means future auditors can filter for "grants that happened outside the UI flow" — useful for separating operational bootstrap actions from in-app admin behavior.
