import NextAuth, { type NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import { aggregates, readModels } from '@/sorc';
import type {
    PlatformRoleStreamInstance,
} from '@/domains/admin';
import type { SorcUUID } from '@event-sorcerer/core';
import type { ImpersonationState } from '@/lib/impersonation';

const isProd = process.env.NODE_ENV === 'production';

export const SESSION_TOKEN_COOKIE_NAME = isProd
    ? '__Host-finances.session-token'
    : 'finances.session-token';

// Singleton Mongo client. The Auth.js adapter accepts a Promise<MongoClient>.
const mongoUri =
    process.env.AUTH_MONGO_URI ??
    'mongodb://localhost:27020,localhost:27021,localhost:27022/?replicaSet=rs0';

const globalForMongo = globalThis as unknown as {
    __financesAuthMongo?: Promise<MongoClient>;
};

export const authMongoClientPromise =
    globalForMongo.__financesAuthMongo ??
    new MongoClient(mongoUri).connect();

if (!isProd) {
    globalForMongo.__financesAuthMongo = authMongoClientPromise;
}

function platformRoleStream(userId: string): PlatformRoleStreamInstance {
    return `platform-role-${userId}` as PlatformRoleStreamInstance;
}

export const authConfig: NextAuthConfig = {
    adapter: MongoDBAdapter(authMongoClientPromise, { databaseName: 'finances_auth' }),
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
                };
                if (raw.impersonation) {
                    session.user.impersonation = raw.impersonation;
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
            if (!isNewUser || !user.id) return;

            try {
                const existing = await readModels.platformRoles.find({});
                if (existing.length > 0) return;

                const targetUserId = user.id as SorcUUID;
                const stream = platformRoleStream(targetUserId);
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
