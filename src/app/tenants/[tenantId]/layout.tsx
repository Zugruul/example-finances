import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { writeLastTenantCookie } from '@/lib/last-tenant-cookie';
import { FINANCES_MODULE_ID } from '@/modules/finances.manifest';

// Path-prefix → moduleId mapping. When a request targets one of these
// per-tenant subpaths and the tenant doesn't have the module
// installed + enabled, the layout 404s. Members + Audit + Options are
// always-present built-ins that don't appear here.
const MODULE_PATH_PREFIXES: Array<{ prefix: string; moduleId: string }> = [
    { prefix: '/dashboard', moduleId: FINANCES_MODULE_ID },
    { prefix: '/accounts', moduleId: FINANCES_MODULE_ID },
    { prefix: '/transactions', moduleId: FINANCES_MODULE_ID },
    { prefix: '/categories', moduleId: FINANCES_MODULE_ID },
    { prefix: '/budgets', moduleId: FINANCES_MODULE_ID },
    { prefix: '/recurring', moduleId: FINANCES_MODULE_ID },
];

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

    // Module gate: if the requested path lives under a module prefix
    // (e.g. /tenants/[id]/transactions/...) and that module isn't
    // installed on this tenant, 404. Built-in subpaths (members,
    // audit) always pass.
    const h = await headers();
    const requestPath =
        h.get('x-invoke-path') ??
        h.get('x-pathname') ??
        h.get('next-url') ??
        '';
    const subPath = requestPath.replace(
        new RegExp(`^/tenants/${tenantId}`),
        '',
    );
    const match = MODULE_PATH_PREFIXES.find(
        (m) => subPath === m.prefix || subPath.startsWith(`${m.prefix}/`),
    );
    if (match) {
        const installed = await readModels.tenantModules.findOne({
            aggregateKey: `${tenantId}|${match.moduleId}`,
        });
        if (!installed || installed.status !== 'installed') {
            notFound();
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
