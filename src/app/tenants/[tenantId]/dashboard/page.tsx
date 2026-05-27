import { redirect } from 'next/navigation';

/**
 * Temporary stopgap so the new "Dashboard" sidebar item under each
 * tenant doesn't 404 while the refactor that gives this route a real,
 * tenant-scoped render is still in flight. Forwards to /dashboard with
 * the tenant id as the filter; the global dashboard's tenant dropdown
 * already supports a single-tenant scope via that query param.
 */
export default async function TenantDashboardRedirect({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;
    redirect(`/dashboard?tenantId=${encodeURIComponent(tenantId)}`);
}
