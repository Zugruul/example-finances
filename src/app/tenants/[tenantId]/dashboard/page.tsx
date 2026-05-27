import DashboardPage from '@/app/dashboard/page';

/**
 * Per-tenant dashboard route. Renders the same page as `/dashboard`
 * but with the tenant filter locked to the path's `tenantId`.
 *
 * Implementation note: Server Components are async functions returning
 * JSX, so we can call the global dashboard's default export directly
 * and inject `searchParams.tenantId` from the path. No code
 * duplication, no redirect — the URL stays `/tenants/<id>/dashboard`
 * so the sidebar's Workspace > Dashboard item highlights correctly.
 */
export default async function TenantDashboardPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;
    return DashboardPage({
        searchParams: Promise.resolve({ tenantId }),
    });
}
