import { revalidatePath } from 'next/cache';

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
 */
export function revalidateTenantDashboards(tenantId: string): void {
    revalidatePath('/dashboard');
    revalidatePath(`/tenants/${tenantId}/dashboard`);
}
