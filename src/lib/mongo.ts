import { MongoClient } from 'mongodb';

/**
 * Single Mongo DB for the whole app: event store + read models + Auth.js.
 * Collections are namespaced by prefix:
 *   - `events`, `events_compendium`, `events_crypto_keys` — event store
 *   - `rm_*` — read models
 *   - `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verification_tokens` — Auth.js
 */
export const FINANCES_DB = 'finances';

/**
 * Ensure the URI explicitly carries `/finances` as the default DB so that
 * `client.db()` (no-arg) inside `@event-sorcerer/engine-mongo` resolves to
 * the consolidated DB. If the URI already has a non-empty default-db path,
 * leave it alone (assume the operator chose it deliberately).
 */
export function withDefaultDb(uri: string, db: string = FINANCES_DB): string {
    // mongodb://[user:pass@]host[,host...][/[defaultDb]][?query]
    const queryIdx = uri.indexOf('?');
    const beforeQuery = queryIdx >= 0 ? uri.slice(0, queryIdx) : uri;
    const query = queryIdx >= 0 ? uri.slice(queryIdx) : '';

    // Strip mongodb:// prefix for parsing.
    const schemeMatch = beforeQuery.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
    if (!schemeMatch) return uri; // give up; let driver complain
    const scheme = schemeMatch[1];
    const rest = schemeMatch[2];

    // Find the FIRST `/` after host-list. Auth `user:pass` segment may have
    // an `@` but never `/` (per RFC 3986 — special chars must be URL-encoded).
    const slashIdx = rest.indexOf('/');
    if (slashIdx < 0) {
        // No path at all → append /<db>
        return `${scheme}${rest}/${db}${query}`;
    }
    const hostPart = rest.slice(0, slashIdx);
    const pathPart = rest.slice(slashIdx + 1);
    if (pathPart.length > 0) {
        // Operator already chose a default db — respect it.
        return uri;
    }
    return `${scheme}${hostPart}/${db}${query}`;
}

/**
 * Default Mongo URI for local dev (replica set on host ports 27020-22).
 * Used when neither `FINANCES_MONGO_URI` nor `AUTH_MONGO_URI` is set.
 */
export const DEFAULT_MONGO_URI =
    'mongodb://localhost:27020,localhost:27021,localhost:27022/?replicaSet=rs0';

export function resolveMongoUri(): string {
    const raw =
        process.env.FINANCES_MONGO_URI ??
        process.env.AUTH_MONGO_URI ??
        DEFAULT_MONGO_URI;
    return withDefaultDb(raw, FINANCES_DB);
}

/**
 * Shared MongoClient promise. Cached on globalThis so HMR doesn't open a new
 * pool on every refresh and so the event store + read models + Auth.js all
 * share a single connection pool. The Auth.js adapter accepts
 * `Promise<MongoClient>`; engine-mongo accepts a `createClient: () => MongoClient`
 * — see `getSharedMongoClient` (sync) for that consumer.
 */
const globalForMongo = globalThis as unknown as {
    __financesMongoClient?: MongoClient;
    __financesMongoClientPromise?: Promise<MongoClient>;
};

function buildClient(): MongoClient {
    return new MongoClient(resolveMongoUri());
}

export function getSharedMongoClient(): MongoClient {
    if (!globalForMongo.__financesMongoClient) {
        globalForMongo.__financesMongoClient = buildClient();
    }
    return globalForMongo.__financesMongoClient;
}

export function getSharedMongoClientPromise(): Promise<MongoClient> {
    if (!globalForMongo.__financesMongoClientPromise) {
        globalForMongo.__financesMongoClientPromise =
            getSharedMongoClient().connect();
    }
    return globalForMongo.__financesMongoClientPromise;
}
