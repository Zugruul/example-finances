import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { writeLastTenantCookie } from '@/lib/last-tenant-cookie';

export default async function TenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/auth/signin');
    }

    const memberships = (
        await readModels.memberships.find({ userId: session.user.id })
    ).filter((m) => !m.removedAt && String(m.tenantId) === tenantId);

    if (memberships.length === 0) {
        // Admin impersonation overrides the membership gate — admins can
        // navigate into any tenant they're not a member of. The session
        // callback already collapses an expired admin session to the
        // target user, so reaching this branch under impersonation means
        // the impersonated target is being routed correctly.
        if (session.user.isAdmin !== true) {
            redirect('/tenants');
        }
    }

    // Remember the last tenant the user navigated into so global routes
    // (/dashboard, /settings, /profile) can resolve workspace-nav hrefs
    // back to it. Next 16 only permits cookies().set in Server Actions,
    // Route Handlers, and the *root* layout/proxy chain during a
    // navigation. Setting from a nested layout during a render works in
    // practice but Next has flagged it as undefined-behavior in some
    // releases; swallow errors so a future Next upgrade can't break the
    // tenant gate.
    try {
        await writeLastTenantCookie(tenantId);
    } catch {
        // ignore — sidebar gracefully falls back to myTenantIds[0]
    }

    return <>{children}</>;
}
