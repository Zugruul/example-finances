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
        // Admin-override: an admin can navigate into any tenant they're
        // not a member of — useful for inspection. BUT while
        // impersonating, the admin is acting as the target user; if the
        // target isn't a member, the redirect kicks in just like it
        // would for any non-member user. This preserves the "see-as-
        // target" guarantee — the admin can't sneak past a tenant gate
        // mid-impersonation. (The session-id swap means
        // `session.user.id` is the target's here, so the memberships
        // lookup above is already target-scoped.)
        const isImpersonating = !!session.user.impersonation;
        if (session.user.isAdmin !== true || isImpersonating) {
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
