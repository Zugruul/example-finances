import NextAuth, { type NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { FINANCES_DB, getSharedMongoClientPromise } from '@/lib/mongo';
import { aggregates, readModels } from '@/sorc';
import type {
    AdminActionsStreamInstance,
    PlatformRoleStreamInstance,
} from '@/domains/admin';
import type { UserStreamInstance } from '@/domains/users';
import { requestContext, type SorcUUID } from '@event-sorcerer/core';
import {
    type ImpersonationState,
    isImpersonationExpired,
    sweepExpiredImpersonation,
} from '@/lib/impersonation';

const isProd = process.env.NODE_ENV === 'production';

export const SESSION_TOKEN_COOKIE_NAME = isProd
    ? '__Host-finances.session-token'
    : 'finances.session-token';

// Auth.js shares the consolidated MongoClient with the event store and read
// models — see `src/lib/mongo.ts`. Re-exported for callers that already used
// `authMongoClientPromise` (impersonation helpers, lib/auth-users, etc.).
export const authMongoClientPromise = getSharedMongoClientPromise();

function platformRoleStream(userId: string): PlatformRoleStreamInstance {
    return `platform-role-${userId}` as PlatformRoleStreamInstance;
}

function userStream(userId: string): UserStreamInstance {
    return `user-${userId}` as UserStreamInstance;
}

function adminActionsStream(adminId: string): AdminActionsStreamInstance {
    return `admin-actions-${adminId}` as AdminActionsStreamInstance;
}

export const authConfig: NextAuthConfig = {
    adapter: MongoDBAdapter(authMongoClientPromise, {
        databaseName: FINANCES_DB,
        collections: {
            Users: 'auth_users',
            Accounts: 'auth_accounts',
            Sessions: 'auth_sessions',
            VerificationTokens: 'auth_verification_tokens',
        },
    }),
    session: { strategy: 'database' },
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
        }),
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
    pages: {
        signIn: '/auth/signin',
    },
    cookies: {
        sessionToken: {
            name: SESSION_TOKEN_COOKIE_NAME,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: isProd,
            },
        },
    },
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
                const role = await readModels.platformRoles.findOne({
                    userId: user.id as SorcUUID,
                });
                session.user.isAdmin = role?.role === 'admin';

                // Impersonation state lives on the Auth.js session document
                // (`finances_auth.sessions.impersonation`). The MongoDB
                // adapter returns the full session doc here but doesn't
                // surface custom fields in its TypeScript types — cast to
                // read it.
                const raw = session as typeof session & {
                    impersonation?: ImpersonationState;
                    sessionToken?: string;
                };
                if (raw.impersonation) {
                    if (isImpersonationExpired(raw.impersonation)) {
                        // TTL sweep: hard-cap at IMPERSONATION_TTL_MS since
                        // startedAt. Use the CAS-atomic
                        // sweepExpiredImpersonation helper — only the
                        // caller that wins the $unset gets a non-null
                        // return, and only that caller emits the
                        // synthetic ImpersonationEnded {reason:'expired'}
                        // audit event. Concurrent session reads see null
                        // and stay silent.
                        //
                        // Fail-closed: any error in the sweep logs and
                        // falls through WITHOUT surfacing impersonation
                        // on the session. An expired session must never
                        // appear active because of a transient hiccup.
                        const expired = raw.impersonation;
                        try {
                            const sessionToken = raw.sessionToken;
                            if (sessionToken) {
                                const client = await authMongoClientPromise;
                                const cleared = await sweepExpiredImpersonation(
                                    client,
                                    sessionToken,
                                    expired.startedAt,
                                );
                                if (cleared) {
                                    const adminId =
                                        expired.actorAdminId as SorcUUID;
                                    const stream = adminActionsStream(adminId);
                                    // Stamp the synthetic Ended event
                                    // with the same dual-actor metadata
                                    // a manual end would have carried:
                                    // actor = impersonated target,
                                    // onBehalfOf = the real admin. Mirrors
                                    // the wrapping that withActorContext
                                    // applies to server actions, just
                                    // here we bind the ALS directly since
                                    // this runs in the session callback,
                                    // not a server-action handler.
                                    await requestContext.run(
                                        {
                                            actor: expired.targetUserId,
                                            onBehalfOf: expired.actorAdminId,
                                        },
                                        async () => {
                                            await aggregates.adminActions.execute(
                                                'endImpersonation',
                                                {
                                                    actorAdminId: adminId,
                                                    targetUserId:
                                                        expired.targetUserId as SorcUUID,
                                                    reason: 'expired',
                                                    stream,
                                                } as never,
                                                {
                                                    store: 'mongostore' as never,
                                                    stream,
                                                },
                                            );
                                        },
                                    );
                                }
                            }
                        } catch (err) {
                            console.error(
                                '[auth] impersonation TTL sweep failed',
                                err,
                            );
                        }
                    } else {
                        session.user.impersonation = raw.impersonation;
                    }
                }
            }
            return session;
        },
    },
    events: {
        async signIn({ user, isNewUser }) {
            console.info('[auth] signIn', {
                userId: user.id,
                email: user.email,
                isNewUser,
            });

            // First-user-is-admin bootstrap: when a brand-new user signs in
            // AND the platform-roles read model is empty, auto-grant admin.
            // The stream-existence check via the aggregate's optimistic
            // concurrency guard handles double-fire racing across two
            // simultaneous first sign-ins (the second emit would target a
            // non-empty stream → no-op via the idempotency guard).
            if (!user.id) return;

            // Bootstrap per-app user profile (separate from Auth.js user
            // record) on FIRST sign-in for this user-id. Idempotent: the
            // aggregate's `createUser` throws if the stream already has
            // state, and we short-circuit via the read model first.
            //
            // Run inside requestContext.run so the actorContextPlugin
            // stamps the user as the actor on the emitted UserCreated.
            // No impersonation possible at this point — the user is
            // literally authenticating themselves.
            try {
                const targetUserId = user.id as SorcUUID;
                const existingUser = await readModels.usersById.findOne({
                    userId: targetUserId,
                });
                if (!existingUser) {
                    const stream = userStream(targetUserId);
                    await requestContext.run(
                        { actor: targetUserId },
                        async () => {
                            await aggregates.users.execute(
                                'createUser',
                                {
                                    userId: targetUserId,
                                    email: user.email ?? '',
                                    stream,
                                } as never,
                                { store: 'mongostore' as never, stream },
                            );
                        },
                    );
                }
            } catch (err) {
                console.error('[auth] user-profile bootstrap failed', err);
            }

            if (!isNewUser) return;

            try {
                const existing = await readModels.platformRoles.find({});
                if (existing.length > 0) return;

                const targetUserId = user.id as SorcUUID;
                const stream = platformRoleStream(targetUserId);
                // First-user bootstrap: the user grants themselves
                // admin via the synthetic `'system'` actor on the
                // command, but the envelope actor is the user — there
                // is no separate admin at this point.
                await requestContext.run({ actor: targetUserId }, async () => {
                    await aggregates.platformRole.execute(
                        'grantAdmin',
                        {
                            targetUserId,
                            grantedByUserId: 'system' as SorcUUID,
                            reason: 'First user (auto-bootstrap)',
                            stream,
                        } as never,
                        { store: 'mongostore' as never, stream },
                    );
                });
                console.info(
                    `[auth] First user ${user.email ?? user.id} auto-granted admin (bootstrap).`,
                );
            } catch (err) {
                console.error('[auth] platform-role bootstrap failed', err);
            }
        },
    },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
