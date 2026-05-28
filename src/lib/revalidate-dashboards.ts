import { revalidatePath } from 'next/cache';
import { revalidateReadModelTag } from '@/lib/cached-read-models';

/**
 * Bust both the global dashboard cache and this tenant's per-tenant
 * dashboard cache. Called from server actions that mutate read-model
 * data the dashboard renders (transactions, budgets, recurring,
 * accounts, categories, tenant rename).
 *
 * The global `/dashboard` shows cross-tenant aggregates; the per-
 * tenant route shows the same widgets scoped to one tenant. Any
 * action that changes the underlying read-model rows can affect
 * either view, so we always bust both.
 *
 * Also invalidates every read-model tag the dashboard reads from.
 * Future cached read paths (via `cachedFind` in cached-read-models)
 * automatically pick up the change on next request without
 * requiring per-page path enumeration.
 */
const DASHBOARD_READ_MODELS = [
    'transactions',
    'accounts-by-tenant',
    'account-balance',
    'categories-by-tenant',
    'budgets-by-tenant',
    'recurring-templates',
    'monthly-aggregate',
];

export function revalidateTenantDashboards(tenantId: string): void {
    revalidatePath('/dashboard');
    revalidatePath(`/tenants/${tenantId}/dashboard`);
    for (const name of DASHBOARD_READ_MODELS) {
        revalidateReadModelTag(name, tenantId);
    }
}
