/**
 * Tenant-audit event query helpers. Direct Mongo for sort + cursor +
 * limit; then `sorc.getPluginManager().executeAfterRetrieval(...)` so
 * cryptoshredded fields (transaction descriptions, etc.) come back
 * decrypted on the way out.
 *
 * Cursor pagination:
 *   - Newest-first ordering: sort `(publishedAt DESC, uuid DESC)`.
 *   - "Older" cursor = `{publishedAt, uuid}` of the OLDEST card visible.
 *     Next page asks for events with that or earlier `publishedAt`,
 *     excluding any with `uuid >= cursor.uuid` at the same timestamp.
 *   - "Newer" cursor (used by the SSE replay path) = `{publishedAt, uuid}`
 *     of the NEWEST card observed. Next call asks for events strictly
 *     greater on `(publishedAt, uuid)`.
 */
import type { ObjectId } from 'mongodb';
import { sorc } from '@/sorc';
import { FINANCES_DB, getSharedMongoClient } from '@/lib/mongo';

const COLL = 'events';

export interface PagedCursor {
    publishedAt: string; // ISO
    uuid: string;
}

export interface PagedResult {
    events: RawEvent[];
    nextOlder: PagedCursor | null;
    newest: PagedCursor | null;
}

export interface RawEvent {
    uuid: string;
    name: string;
    version: string;
    stream: string;
    publishedAt: string;
    payload: Record<string, any>;
    revision?: string;
}

function tenantMatch(tenantId: string): Record<string, any> {
    // An event is tenant-scoped when EITHER its stream IS the tenant
    // aggregate (stream === `tenant-<id>`) OR its payload denormalizes
    // the tenantId field. The latter covers every domain event we emit
    // (transactions, accounts, budgets, categories, recurring-templates,
    // memberships, etc.). Users/admin streams are NOT tenant-scoped.
    return {
        $or: [
            { stream: `tenant-${tenantId}` },
            { 'payload.tenantId': tenantId },
        ],
    };
}

function tenantsMatch(tenantIds: string[]): Record<string, any> {
    // Multi-tenant OR: events whose stream matches ANY of the tenant
    // streams, OR whose payload.tenantId is IN the set. Used by the
    // top-level cross-tenant audit at /audit.
    return {
        $or: [
            { stream: { $in: tenantIds.map((t) => `tenant-${t}`) } },
            { 'payload.tenantId': { $in: tenantIds } },
        ],
    };
}

/**
 * One page of newest-first events for a tenant. When `olderThan` is
 * undefined, returns the most recent `limit` events. Otherwise returns
 * the next `limit` events strictly older than the cursor (with uuid
 * tiebreaker for same-millisecond entries).
 *
 * Pass `tenantIds` instead of `tenantId` to OR-match across multiple
 * tenants (used by the cross-tenant audit at /audit).
 */
export async function fetchAuditPage(params: {
    tenantId?: string;
    tenantIds?: string[];
    olderThan?: PagedCursor;
    limit?: number;
}): Promise<PagedResult> {
    const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
    const match: Record<string, any> = params.tenantIds
        ? tenantsMatch(params.tenantIds)
        : tenantMatch(params.tenantId ?? '');
    if (params.olderThan) {
        const pa = new Date(params.olderThan.publishedAt);
        match.$and = [
            {
                $or: [
                    { publishedAt: { $lt: pa } },
                    {
                        publishedAt: pa,
                        uuid: { $lt: params.olderThan.uuid },
                    },
                ],
            },
        ];
    }

    const client = getSharedMongoClient();
    const coll = client
        .db(FINANCES_DB)
        .collection<RawDoc>(COLL);
    const docs = await coll
        .find(match, { sort: { publishedAt: -1, uuid: -1 }, limit })
        .toArray();

    const decrypted = await runAfterRetrieval(docs);
    const events = decrypted.map(toRaw);
    const oldest = events.length > 0 ? events[events.length - 1] : null;
    const newest = events.length > 0 ? events[0] : null;
    return {
        events,
        nextOlder: oldest
            ? { publishedAt: oldest.publishedAt, uuid: oldest.uuid }
            : null,
        newest: newest
            ? { publishedAt: newest.publishedAt, uuid: newest.uuid }
            : null,
    };
}

/**
 * Events strictly newer than `since` (used for SSE replay on reconnect).
 * Sorted ASC so we can emit in chronological order; the client prepends
 * each one to its newest-first list.
 */
export async function fetchEventsSince(params: {
    tenantId: string;
    since: PagedCursor;
    limit?: number;
}): Promise<RawEvent[]> {
    const limit = Math.max(1, Math.min(params.limit ?? 500, 2000));
    const pa = new Date(params.since.publishedAt);
    const match = {
        ...tenantMatch(params.tenantId),
        $and: [
            {
                $or: [
                    { publishedAt: { $gt: pa } },
                    {
                        publishedAt: pa,
                        uuid: { $gt: params.since.uuid },
                    },
                ],
            },
        ],
    };
    const client = getSharedMongoClient();
    const coll = client.db(FINANCES_DB).collection<RawDoc>(COLL);
    const docs = await coll
        .find(match, { sort: { publishedAt: 1, uuid: 1 }, limit })
        .toArray();
    const decrypted = await runAfterRetrieval(docs);
    return decrypted.map(toRaw);
}

type RawDoc = {
    _id?: ObjectId;
    uuid: string;
    name: string;
    version: string;
    stream: string;
    publishedAt: Date;
    payload: Record<string, any>;
    revision?: unknown;
};

function toRaw(doc: RawDoc): RawEvent {
    return {
        uuid: doc.uuid,
        name: doc.name,
        version: doc.version,
        stream: doc.stream,
        publishedAt:
            doc.publishedAt instanceof Date
                ? doc.publishedAt.toISOString()
                : new Date(doc.publishedAt as any).toISOString(),
        payload: doc.payload,
    };
}

async function runAfterRetrieval(docs: RawDoc[]): Promise<RawDoc[]> {
    if (docs.length === 0) return docs;
    try {
        const out = await sorc
            .getPluginManager()
            .executeAfterRetrieval(docs as any, sorc as any);
        return out as RawDoc[];
    } catch (err) {
        console.warn('[audit] afterRetrieval failed; serving raw', err);
        return docs;
    }
}
