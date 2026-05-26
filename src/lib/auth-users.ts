import { MongoClient } from 'mongodb';

export type AuthUser = {
    _id: string;
    email?: string;
    name?: string;
    image?: string;
    emailVerified?: Date;
};

const globalForMongo = globalThis as unknown as {
    __financesAuthUsersClient?: Promise<MongoClient>;
};

function getClient(): Promise<MongoClient> {
    if (!globalForMongo.__financesAuthUsersClient) {
        const uri =
            process.env.AUTH_MONGO_URI ??
            'mongodb://localhost:27020,localhost:27021,localhost:27022/?replicaSet=rs0';
        globalForMongo.__financesAuthUsersClient = new MongoClient(uri).connect();
    }
    return globalForMongo.__financesAuthUsersClient;
}

/**
 * Reads users directly from the Auth.js MongoDB adapter's `users`
 * collection. Admin-only — exposes raw email/name PII. Wave A: paged
 * scan; Wave B can swap to an aggregation pipeline if the user base
 * grows.
 */
export async function listAuthUsers(limit = 100): Promise<AuthUser[]> {
    const client = await getClient();
    const db = client.db('finances_auth');
    const cursor = db
        .collection<AuthUser>('users')
        .find({}, { limit, sort: { _id: -1 } });
    return cursor.toArray();
}
