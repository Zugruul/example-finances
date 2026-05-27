import { FINANCES_DB, getSharedMongoClientPromise } from '@/lib/mongo';

export type AuthUser = {
    _id: string;
    email?: string;
    name?: string;
    image?: string;
    emailVerified?: Date;
};

/**
 * Reads users directly from the Auth.js MongoDB adapter's `auth_users`
 * collection (renamed from the default `users` in F.C.consolidate-db so
 * Auth.js, the event store, and the read models can share a single
 * `finances` database without colliding). Admin-only — exposes raw
 * email/name PII.
 */
export async function listAuthUsers(limit = 100): Promise<AuthUser[]> {
    const client = await getSharedMongoClientPromise();
    const db = client.db(FINANCES_DB);
    const cursor = db
        .collection<AuthUser>('auth_users')
        .find({}, { limit, sort: { _id: -1 } });
    return cursor.toArray();
}
