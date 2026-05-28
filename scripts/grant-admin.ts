/**
 * CLI: grant platform-admin to a user by email.
 *
 * Usage:
 *   pnpm admin:grant user@example.com
 *
 * See `examples/example-finances/.claude/skills/grant-admin.md` for the full
 * skill documentation: when to use this vs. the in-app /admin/users UI vs.
 * the first-user-is-admin auto-bootstrap, outcomes, and edge cases.
 *
 * The script:
 *   1. Looks up the user by lowercased email in `finances_auth.users`
 *      (Auth.js's MongoDB-adapter collection).
 *   2. Resolves the userId.
 *   3. Publishes an `AdminGranted` event via the platform-role aggregate
 *      (stream `platform-role-{userId}`) — same path the in-app UI uses,
 *      so the grant lands in `admin-activity` audit feed too.
 *   4. Idempotent: re-running for an already-admin user is a no-op (the
 *      aggregate's grantAdmin command short-circuits).
 *
 * The grant is tagged with `grantedByUserId: 'cli-bootstrap'` (literal
 * sentinel — distinguishes CLI grants from UI grants in the audit log).
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { aggregates, readModels } from '@/sorc';
import type { SorcUUID } from '@event-sorcerer/core';
import type { PlatformRoleStreamInstance } from '@/domains/admin';

const CLI_ACTOR = 'cli-bootstrap' as SorcUUID;

const DEFAULT_MONGO_URI =
    'mongodb://admin:password@localhost:27020,localhost:27021,localhost:27022/?authSource=admin&replicaSet=rs0';

function platformRoleStream(userId: string): PlatformRoleStreamInstance {
    return `platform-role-${userId}` as PlatformRoleStreamInstance;
}

async function main(): Promise<number> {
    const argEmail = process.argv[2];
    if (!argEmail) {
        console.error(
            'Usage: pnpm admin:grant <email>\n\n' +
                'Grant platform-admin (system-wide admin role) to a user by email.\n' +
                'The user must have signed in at least once via OAuth so their record\n' +
                'exists in finances_auth.users. See .claude/skills/grant-admin.md for\n' +
                'the full skill documentation.',
        );
        return 1;
    }
    const email = argEmail.trim().toLowerCase();
    if (!email.includes('@')) {
        console.error(`✗ "${argEmail}" doesn't look like an email.`);
        return 1;
    }

    const uri =
        process.env.AUTH_MONGO_URI ??
        process.env.FINANCES_MONGO_URI ??
        DEFAULT_MONGO_URI;

    const client = new MongoClient(uri);
    try {
        await client.connect();
    } catch (err) {
        console.error(`✗ Could not connect to Mongo at ${uri}`);
        console.error(err instanceof Error ? err.message : err);
        return 1;
    }

    let userId: string;
    try {
        // Consolidated `finances` DB layout (Wave-B): Auth.js's users
        // live as `auth_users` inside the single `finances` DB rather
        // than a separate `finances_auth` database. Look there first,
        // fall back to the legacy location for older deployments.
        const financesUsers = client
            .db('finances')
            .collection<{ _id: unknown; email?: string }>('auth_users');
        let user = await financesUsers.findOne({ email });
        if (!user) {
            const legacy = client
                .db('finances_auth')
                .collection<{ _id: unknown; email?: string }>('users');
            user = await legacy.findOne({ email });
        }
        if (!user) {
            console.error(
                `✗ No user found for ${email} in finances.auth_users (or legacy finances_auth.users).\n` +
                    '  They must sign in once via OAuth before you can grant admin.\n' +
                    '  Start the dev server (pnpm dev), have them sign in at /auth/signin,\n' +
                    '  then re-run this script.',
            );
            return 1;
        }
        userId = String(user._id);
    } finally {
        await client.close().catch(() => {});
    }

    // Idempotent: aggregate's grantAdmin no-ops if already admin. We still
    // check the read model first so the success line is honest about whether
    // anything changed.
    const existing = await readModels.platformRoles.find({ userId });
    const alreadyAdmin =
        existing.length > 0 && existing[0]?.role === 'admin';

    if (alreadyAdmin) {
        console.log(
            `· ${email} is already platform-admin (userId=${userId}). No change.`,
        );
        return 0;
    }

    const stream = platformRoleStream(userId);
    try {
        await aggregates.platformRole.execute(
            'grantAdmin',
            {
                targetUserId: userId as SorcUUID,
                grantedByUserId: CLI_ACTOR,
                reason: 'Granted via grant-admin script',
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
    } catch (err) {
        console.error(
            `✗ Failed to publish AdminGranted for ${email} (userId=${userId}):`,
        );
        console.error(err instanceof Error ? err.message : err);
        return 1;
    }

    console.log(
        `✓ Granted platform-admin to ${email} (userId=${userId}).\n` +
            '  They will be admin on their next request.\n' +
            '  Audit trail: /admin/audit-log → "AdminGranted" with grantedByUserId="cli-bootstrap".',
    );
    return 0;
}

main()
    .then((code) => process.exit(code))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
