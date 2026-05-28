import { unstable_cache, revalidateTag } from 'next/cache';

/**
 * Tagged read-model caching.
 *
 * Wraps a read-model `find()` (or `findOne()`) call in Next.js's
 * `unstable_cache` keyed by the underlying query + tagged with a
 * stable string. Server actions that mutate the data invalidate
 * those tags via `revalidateReadModelTag`. Stale-data plan B from
 * .claude/handoffs/research-stale-data.md.
 *
 * Why a custom layer instead of putting `unstable_cache` directly
 * on every read site? Three reasons:
 *  1. Tag naming is centralized — every consumer reads + writes
 *     the same `readmodel:<name>:tenant:<id>` shape, so cache
 *     invalidation can't drift.
 *  2. The cached key includes the entire query object via JSON
 *     stringify, so two pages reading the same model with
 *     different filters don't share a cache slot.
 *  3. Server actions only need `revalidateReadModelTag(name, tid)`
 *     — they don't have to know that the dashboard happens to
 *     read `accounts-by-tenant` differently than `/accounts`.
 *
 * Trade-offs:
 *  - Caching introduces a coherence window where read after write
 *    can see stale data if the write didn't bump the right tag.
 *    Mitigation: every server-action helper that already calls
 *    `revalidateTenantDashboards()` should ALSO call
 *    `revalidateReadModelTag()` for the domains it touches.
 *  - Cache keys serialize the query shape, so non-JSON values
 *    (Date, ObjectId) coerce via `toJSON`. Reads with such filters
 *    should use this only for trivially-stringifyable queries.
 */

/** Tag for a specific (read-model, tenant) pair. */
export function readModelTenantTag(
    readModelName: string,
    tenantId: string,
): string {
    return `rm:${readModelName}:tenant:${tenantId}`;
}

/** Coarser tag for an entire read-model (cross-tenant). */
export function readModelTag(readModelName: string): string {
    return `rm:${readModelName}`;
}

/**
 * Invalidate every cached query for `(readModelName, tenantId)`.
 * Call from server actions immediately after publishing the event
 * that affects this read model. Also drops the coarser
 * `rm:<name>` tag so cross-tenant reads (e.g. /admin pages) pick
 * up the change too.
 */
export function revalidateReadModelTag(
    readModelName: string,
    tenantId?: string,
): void {
    // Next 16's `revalidateTag` requires a cache-life profile second
    // arg. `'default'` matches the bundled default profile used by
    // our `cachedFind` wrapper below.
    if (tenantId) {
        revalidateTag(
            readModelTenantTag(readModelName, tenantId),
            'default',
        );
    }
    revalidateTag(readModelTag(readModelName), 'default');
}

/**
 * Wrap a read-model `find` callback in a tagged cache. The
 * returned function takes the same query argument and returns the
 * same Promise, but cached + tagged.
 *
 * `tenantId` is optional — pass it for queries that are naturally
 * tenant-scoped so the cache slot can be invalidated per-tenant.
 * Without a tenantId, the slot is only invalidated by the coarser
 * `rm:<name>` tag.
 */
export function cachedFind<TQuery extends Record<string, unknown>, TDoc>(
    readModelName: string,
    finder: (query: TQuery) => Promise<TDoc[]>,
    opts?: { tenantId?: string; revalidate?: number },
): (query: TQuery) => Promise<TDoc[]> {
    return async (query: TQuery) => {
        const tenantId =
            opts?.tenantId ?? (query as { tenantId?: string }).tenantId;
        const tags = [
            readModelTag(readModelName),
            ...(tenantId
                ? [readModelTenantTag(readModelName, String(tenantId))]
                : []),
        ];
        const key = [readModelName, JSON.stringify(query ?? {})];
        const wrapped = unstable_cache(
            async () => finder(query),
            key,
            {
                tags,
                // Default 60s — refresh every minute even if no
                // explicit invalidation happens. Caller can override.
                revalidate: opts?.revalidate ?? 60,
            },
        );
        return wrapped();
    };
}
