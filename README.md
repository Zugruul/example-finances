# example-finances

Reference consumer app for the [Event Sorcerer](https://github.com/zugruul/event-sorcerer) framework. Multi-tenant finance tracker that demonstrates every framework primitive: OAuth2 (GitHub + Google via Auth.js v5), event-sourced domains with cryptoshredded PII, server actions, multi-tenant aggregates, system-wide admin with shadow-login impersonation, and a Prometheus `/metrics` scrape.

> **Status:** Wave A shipped — auth, multi-tenant Tenants domain, admin dashboard with audit-logged impersonation, and the metrics endpoint are all live. Users, Accounts, Transactions, and CSV import land in waves B–F.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack default; `proxy.ts` replaces `middleware.ts`) |
| React | 19.2 |
| Styling | Tailwind 4 |
| Components | shadcn (canary, `base-nova` preset / base-ui not Radix) |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta`) + Mongo adapter, **database sessions** |
| Event store | `@event-sorcerer/engine-mongo` (durable) + `@event-sorcerer/engine-memory` (kept registered for future fallback) |
| Cryptoshredding | `@event-sorcerer/plugin-cryptoshredding` with `keyStoreName: 'mongostore'` |
| Read models | `@event-sorcerer/read-models` with `MemoryReadModelStore` (Wave A); Mongo adapter is a Wave B add |
| Metrics | `@event-sorcerer/metrics-prometheus` + `prom-client` |

## Local development

The app lives inside the framework's monorepo as a nested git repository at `examples/example-finances/`. The workspace declares `examples/*`, so `@event-sorcerer/*` packages resolve via `workspace:*` link.

```bash
# From the monorepo root:
pnpm install                          # installs example deps too
pnpm infra:up                         # starts the shared Mongo replica set + Jaeger
pnpm --filter example-finances dev    # boots Next.js on http://localhost:3000
```

Visit `http://localhost:3000` → sign in with GitHub or Google → land on `/dashboard`. Create a tenant at `/tenants/new`; invite teammates from the tenant detail page. The first user to sign in is auto-granted platform-admin (event-sourced via the `platform-role-{userId}` stream); once admin, the `/admin` link is gated open and you can impersonate any registered user, grant/remove admin from `/admin/users`, and review the audit log. Use `pnpm admin:grant <email>` (see `.claude/skills/grant-admin.md`) as the CLI escape hatch when bootstrapping a specific operator or recovering from a wipeout.

### Environment matrix (see `.env.example`)

| Var | Purpose | Required? |
|---|---|---|
| `AUTH_SECRET` | Auth.js signing key. `openssl rand -base64 33`. | required (prod) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth credentials. | required to enable GH |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials. | required to enable Google |
| `AUTH_MONGO_URI` | Mongo URI for the Auth.js adapter. Defaults to the local replica set `localhost:27020-22/?replicaSet=rs0`. | required |
| `FINANCES_MONGO_URI` | Override for the event-store Mongo URI. Falls back to `AUTH_MONGO_URI`, then to the local replica set. | optional |
| `PROM_METRICS_TOKEN` | Bearer for `/api/metrics`. Endpoint returns `503 not configured` if unset. | required to expose metrics |

## Running with Docker

The app ships a multi-stage `Dockerfile` so you can run a deployment-shaped smoke test without installing Node/pnpm locally. The image is wired into the monorepo's `docker-compose.yaml` as the `example-finances` service, on the same `mongo-cluster` network as the Mongo replica set, Prometheus, Grafana, etc.

```bash
# From the monorepo root — first build is ~3 min (downloads node:22-alpine,
# pulls 1100+ workspace deps, runs tsc -b for the framework packages, then
# next build with output:'standalone'). Subsequent builds are layer-cached.
docker compose build example-finances

# `up -d` brings the whole stack (Mongo + observability + the app) online.
docker compose up -d

# Or just the app + its Mongo deps:
docker compose up -d example-finances

# Tail the app's logs
docker compose logs -f example-finances

# Hit it
curl -fsS http://localhost:3000/                        # landing page
curl -fsS http://localhost:3000/api/auth/providers      # Auth.js providers JSON
curl -fsS -H "Authorization: Bearer $PROM_METRICS_TOKEN" \
     http://localhost:3000/api/metrics                  # Prometheus scrape
```

After code changes, rebuild the image:

```bash
docker compose build example-finances && docker compose up -d example-finances
```

### How the build works

The `Dockerfile` lives at `examples/example-finances/Dockerfile` but its **build context is the monorepo root** — that's what lets pnpm resolve `workspace:*` dependencies into the framework packages. The build:

1. `pnpm install --frozen-lockfile` over the full workspace (we don't `--filter=example-finances...` because that mode skips devDependencies of transitive workspace deps, and the framework packages need their own `typescript@5.x` to build).
2. `tsc --build tsconfig.build.json` to emit `dist/` for every framework package the example imports.
3. `pnpm build` (Next.js) in the example, which produces `.next/standalone/` — a self-contained server tree.
4. The runner stage carries **only** `.next/standalone` + `public/`. The fat workspace `node_modules` is left behind.

### env_file + Mongo hostname override

The compose service uses `env_file: ./.env.local` to pass OAuth credentials, `AUTH_SECRET`, and `PROM_METRICS_TOKEN` into the container at runtime. The `.env.local` is gitignored, so secrets never enter the image.

The Mongo URIs in `.env.local` point at `localhost:27020-22` for `pnpm dev`. Inside the docker network the app reaches the replica set via container hostnames, so the compose `environment:` block **overrides** them:

```yaml
AUTH_MONGO_URI: "mongodb://admin:password@mongo1:27020,mongo2:27021,mongo3:27022/?authSource=admin&replicaSet=rs0"
FINANCES_MONGO_URI: "mongodb://admin:password@mongo1:27020,mongo2:27021,mongo3:27022/?authSource=admin&replicaSet=rs0"
```

Note the internal ports are still `27020/27021/27022` (not the conventional `27017`) — each mongo service's `command` passes `--port 27020` etc., so mongod binds those ports inside the container too. `AUTH_URL=http://localhost:3000` and `AUTH_TRUST_HOST=true` are also set so Auth.js v5 accepts requests in `NODE_ENV=production` mode.

### When to use Docker vs `pnpm dev`

| Goal | Use |
|---|---|
| Iterate on the app — fast HMR, source maps, easy debugging | `pnpm dev` |
| Smoke-test the app in a deployment-shaped environment | `docker compose up -d example-finances` |
| Run the app without installing Node/pnpm locally | Docker |
| Sanity-check workspace dep resolution against a clean install | Docker (re-runs `pnpm install` from the lockfile) |

`pnpm dev` is strictly faster for development. Docker is for verifying the prod path works end-to-end.

## Directory layout

```
src/
├── app/                              # App Router pages + route handlers
│   ├── admin/                        # /admin (dashboard), /admin/users, /admin/audit-log
│   ├── api/
│   │   ├── auth/[...nextauth]/       # Auth.js handlers
│   │   └── metrics/                  # Prom-client scrape endpoint
│   ├── auth/signin/                  # GitHub + Google sign-in
│   ├── dashboard/                    # landing destination post-signin
│   └── tenants/                      # /tenants, /tenants/new, /tenants/[id], /tenants/[id]/members
├── components/
│   ├── impersonation-banner.tsx      # RSC banner rendered when the Auth.js session has an impersonation field
│   └── ui/                           # shadcn primitives (13 installed)
├── domains/                          # one folder per domain; barrel exports = public surface
│   ├── admin/                        # AdminActions aggregate + admin-activity read model
│   └── tenants/                      # Tenant + Membership aggregates + read models
├── lib/
│   ├── auth-users.ts                 # direct Mongo read of Auth.js users collection (admin shadow-login source)
│   ├── impersonation.ts              # set/clear the `impersonation` field on the Auth.js session document
│   └── utils.ts                      # cn() helper
├── server/                           # Next.js server actions
│   ├── admin.ts                      # startImpersonationAction / endImpersonationAction
│   └── tenants.ts                    # createTenantAction, invite/changeRole/remove actions
├── auth.ts                           # NextAuth config + handlers
├── sorc.ts                           # Sorc setup: stores, plugins, aggregates, read models
└── types/next-auth.d.ts              # Session.user augmentation (id, isAdmin)
proxy.ts                              # Next 16 successor to middleware.ts; per-request CSP nonce + auth gate
next.config.ts                        # static security headers
eslint.config.mjs                     # boundaries rule for src/domains/*
```

### Domain isolation

Files in `src/domains/X/` may only import from:
- their own folder
- OTHER domains via `src/domains/Y/index.ts` (the **public surface**)
- framework packages (`@event-sorcerer/*`)
- `src/lib/**`, `src/sorc.ts`, `src/auth.ts`

Enforced by `eslint-plugin-boundaries` (`boundaries/dependencies`). Cross-domain id fields in payloads carry a `@foreign('Y')` decorator from `@event-sorcerer/core` to document the dependency edge (metadata-only today; future codegen / ER-diagram tooling will read it).

## Tenants

Multi-tenant from day one. `tenantId` is its own UUID independent of `userId` — a user can belong to multiple tenants, a tenant can have multiple users.

### Streams

| Stream | Aggregate | Events |
|---|---|---|
| `tenant-{tenantId}` | Tenant | `TenantCreated`, `TenantRenamed`, `TenantArchived` |
| `tenant-{tenantId}-membership-{membershipId}` | Membership | `MemberInvited`, `InvitationAccepted`, `MemberRoleChanged`, `MemberRemoved` |

### Roles (per-tenant)

- `owner` — full control; can rename, archive, manage all memberships
- `admin` — can manage memberships
- `member` — read/write data within the tenant (Wave B+)
- `viewer` — read-only

### PII / cryptoshredding

`@property({ tags: ['pii'] })` payload fields are encrypted at rest by the `cryptoshredding` plugin; the keystore lives in the same Mongo replica set as the event log. Wiping the per-aggregate key effectively shreds the corresponding ciphertexts.

PII-tagged today:
- Tenant `displayName`, `description`
- Membership `invitedEmail`, `userId`, `displayName`

### Read models

Backed by `MemoryReadModelStore` for Wave A (`subscribe()` on app boot polls the durable event log every 5s):
- `tenants` — one doc per tenant, keyed by `tenantId`
- `memberships` — one doc per membership, keyed by `membershipId` (UI filters by `userId` via `find({userId})`; a Mongo-backed adapter with a secondary `userId` index lands in Wave B if filtering becomes hot)

### Pages

- `/tenants` — your active memberships + "Create tenant" CTA
- `/tenants/new` — form that runs `createTenant` → `inviteMember{role:'owner'}` → `acceptInvite` in sequence so the creator auto-joins as owner
- `/tenants/[tenantId]` — display name, description, member list, rename + invite forms (owner/admin only)
- `/tenants/[tenantId]/members` — role-change dropdowns + remove buttons (owner/admin only)

Server actions in `src/server/tenants.ts` validate the session, then check the caller's active membership role via the `memberships` read model before dispatching the aggregate command.

## Admin & impersonation

System-wide admin role (separate from per-tenant roles). Event-sourced via the `PlatformRole` aggregate on `platform-role-{userId}` streams (`AdminGranted` / `AdminRemoved` events) and the `platform-roles` read model. The Auth.js `session` callback looks up `readModels.platformRoles.findOne({userId})` and sets `session.user.isAdmin = role?.role === 'admin'`. Bootstrap is **first-user-is-admin** — when the first OAuth signup happens with an empty `platform-roles` read model, `events.signIn` emits `AdminGranted` with `grantedByUserId: 'system'` and `reason: 'First user (auto-bootstrap)'`. Subsequent admins are granted from `/admin/users`. The `admin:grant <email>` CLI script is the escape hatch (`grantedByUserId: 'cli-bootstrap'`) for operator bootstrap and recovery if every admin gets removed.

### Routes

- `/admin` — dashboard: 4 stat tiles (active tenants, total users, active impersonations, admin events 24h) + nav
- `/admin/users` — direct list of every Auth.js user from the `finances_auth.users` Mongo collection. Per row: Impersonate button + Grant/Remove admin button (state-driven by the `platform-roles` read model). `removeAdminAction` has an anti-self-lockout guard — it refuses to remove the last platform admin.
- `/admin/audit-log` — reverse-chronological feed of every event in the `admin-actions-{adminId}` streams

### Shadow login flow

1. Admin clicks "Impersonate" → `startImpersonationAction` (server action, gated on `isAdmin`).
2. Action emits `ImpersonationStarted` to `admin-actions-{adminId}` and writes an `impersonation` field — `{actorAdminId, targetUserId, targetEmail, startedAt}` — onto the Auth.js session document (`finances_auth.sessions`) keyed by the current `sessionToken` cookie.
3. The Auth.js MongoDB adapter returns the full session doc on every `session` callback invocation. The callback in `src/auth.ts` surfaces the `impersonation` field on `session.user.impersonation`. Lives in `src/lib/impersonation.ts`.
4. Persistent amber banner (`ImpersonationBanner` in root layout) renders on every page: *"Impersonating <email>"* with a **Return to admin** form-action that hits `endImpersonationAction`.
5. End action emits `ImpersonationEnded`, `$unset`s the `impersonation` field from the session doc, redirects to `/admin`.

### Audit log

Stream `admin-actions-{adminId}` carries:
- `ImpersonationStarted` — actor, target, target email, started-at
- `ImpersonationEnded` — actor, target, ended-at
- `AdminActionTaken` — actor + action label + free-form note + occurred-at (reserved for Wave B — admin-driven mutations like role grants)

Read model `admin-activity` is one append-only doc per event, keyed by event UUID. Wave A treats this as authoritative for the audit-log page; Wave B may compact older entries into per-admin rollups once volume grows.

### Security caveats (Wave A)

- Impersonation state lives on the Auth.js session document, not in a separate cookie. Signing out deletes the session row, which clears impersonation automatically. Session expiry (Auth.js's default 30-day TTL on the sessions collection) clears it on expiration. There is intentionally only one cookie to protect (`__Host-finances.session-token` in prod), not two.
- The `actor` field on events emitted **while impersonating** is currently the impersonated user's id, not the admin's. Recording the admin as the actor when impersonating needs framework-side request-context plumbing (AsyncLocalStorage through the Sorc); deferred to Wave B (see `decisions-log.md` Q-Open).
- `/admin/**` is double-gated: `proxy.ts` returns 403 for non-admin requests, and every admin server action calls `requireAdmin()` so direct POSTs are rejected too.
- Admin role assignment is event-sourced (NOT env-var). Grant/Remove flows through the `PlatformRole` aggregate; the audit trail is queryable historically, and revocation requires no deploy. `removeAdminAction` has an anti-self-lockout guard. The `admin:grant` CLI is documented for last-resort bootstrap/recovery.

## Prometheus scrape

`/api/metrics` returns the `prom-client` exposition format guarded by a bearer token:

```bash
curl -H "Authorization: Bearer $PROM_METRICS_TOKEN" http://localhost:3000/api/metrics
```

If `PROM_METRICS_TOKEN` is unset the endpoint returns `503 not configured`. With a wrong token it returns `403 forbidden`. The endpoint is allowlisted in `proxy.ts` so the auth gate does not interfere with the scrape.

Example Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: finances
    metrics_path: /api/metrics
    bearer_token: ${PROM_METRICS_TOKEN}
    static_configs:
      - targets: ['localhost:3000']
```

The registry holds:
- `prom-client`'s `collectDefaultMetrics` (process RSS, event-loop lag, GC stats, …)
- `@event-sorcerer/metrics-prometheus` instruments — every publish through the Sorc increments counters tagged with `domain`, `event_name`, `event_version`. Once you create a tenant or invite a member, the Tenants events show up in the scrape.

## Security baseline

- Auth.js v5 with **database sessions** (NOT JWT) — server actions read the session via the cookie without re-validating each request, and signing out invalidates server-side.
- Cookie hardening: `httpOnly`, `sameSite: 'lax'`, `secure` + `__Host-` prefix in production, `path: '/'`.
- CSP with **per-request nonces** generated in `proxy.ts` (`'strict-dynamic'`).
- Static security headers in `next.config.ts`: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`.
- Routes under `/dashboard`, `/tenants`, `/profile`, `/admin` redirect unauth users to `/auth/signin`. `/admin/**` additionally requires `session.user.isAdmin === true`.
- Impersonation state is stored on the Auth.js session document (`finances_auth.sessions.impersonation`), never in a separate cookie. There is one signed surface to protect — the Auth.js session cookie — and signing out invalidates impersonation in lockstep with the session itself.

## Beyond Wave A

Each subsequent wave adds a domain end-to-end (Users → Accounts → Transactions → CSV import) with its own pages, server actions, and read models. The Tenants domain is the structural template — Wave B's first task is to build out `src/domains/users/` keyed on the existing `Membership` flow, then layer Accounts streams (`tenant-{tenantId}-user-{userId}-account-{accountId}`) on top.

See the parent monorepo's `.claude/handoffs/post-wave-A.md` for the closer and the wave-by-wave roadmap.
