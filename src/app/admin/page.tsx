import Link from 'next/link';
import { readModels } from '@/sorc';
import { auth } from '@/auth';
import { listAuthUsers } from '@/lib/auth-users';
import { Button } from '@/components/ui/button';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function getRecentCutoff(): Promise<number> {
    return Date.now() - ONE_DAY_MS;
}

export default async function AdminDashboardPage() {
    const recentCutoff = await getRecentCutoff();
    const session = await auth();
    const [users, tenants, allMemberships, allActivity] = await Promise.all([
        listAuthUsers(1000),
        readModels.tenants.find({}),
        readModels.memberships.find({}),
        readModels.adminActivity.find({}),
    ]);

    // Seed picker scoping: when impersonating, show ONLY the
    // impersonated target's tenants (the admin is acting AS the
    // target — seeing the admin's own tenants here is a leak of
    // their identity into the impersonation session). When NOT
    // impersonating, show the admin's own tenants. Admins still
    // have unfiltered cross-tenant visibility via /admin/users +
    // /admin/audit-log; the seed flow specifically targets
    // workspaces of the currently-acting identity.
    const targetUserId = session?.user?.impersonation?.targetUserId ?? null;
    const seedAsUserId = targetUserId
        ? String(targetUserId)
        : session?.user?.id
          ? String(session.user.id)
          : null;
    const allowedTenantIds = new Set<string>();
    if (seedAsUserId) {
        for (const m of allMemberships) {
            if (m.removedAt) continue;
            if (String(m.userId) === seedAsUserId) {
                allowedTenantIds.add(String(m.tenantId));
            }
        }
    }
    const seedableTenants = tenants.filter(
        (t) => !t.archivedAt && allowedTenantIds.has(String(t.tenantId)),
    );

    const activeImpersonations = new Map<string, number>();
    for (const a of allActivity) {
        if (a.kind === 'ImpersonationStarted') {
            activeImpersonations.set(
                a.actorAdminId,
                (activeImpersonations.get(a.actorAdminId) ?? 0) + 1,
            );
        } else if (a.kind === 'ImpersonationEnded') {
            const n = activeImpersonations.get(a.actorAdminId) ?? 0;
            if (n > 0) activeImpersonations.set(a.actorAdminId, n - 1);
        }
    }
    const activeCount = [...activeImpersonations.values()].reduce(
        (s, n) => s + n,
        0,
    );

    const recentActivityCount = allActivity.filter(
        (a) => new Date(a.occurredAt).getTime() >= recentCutoff,
    ).length;

    const tenantsTotal = tenants.filter((t) => !t.archivedAt).length;

    return (
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-8">
            <BreadcrumbBar items={[{ label: 'Admin' }]} />
            <header className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Admin dashboard
                </h1>
                <div className="flex gap-2">
                    <Link href="/admin/users">
                        <Button variant="outline">Users</Button>
                    </Link>
                    <Link href="/admin/audit-log">
                        <Button variant="outline">Audit log</Button>
                    </Link>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Active tenants" value={tenantsTotal} />
                <StatTile label="Total users" value={users.length} />
                <StatTile
                    label="Active impersonations"
                    value={activeCount}
                />
                <StatTile
                    label="Admin events (24h)"
                    value={recentActivityCount}
                />
            </section>

            <Card>
                <CardHeader>
                    <CardTitle>Seed a tenant</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                    <p className="text-muted-foreground">
                        Populate a tenant with demo data (accounts,
                        categories, sample transactions, budgets, recurring
                        templates). Routes through a 3-phase confirmation —
                        the seed itself isn't reversible.
                    </p>
                    {seedableTenants.length === 0 ? (
                        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                            No tenants you{' '}
                            {session?.user?.impersonation
                                ? 'or the impersonated user '
                                : ''}
                            belong to. Create one from{' '}
                            <Link
                                href="/tenants/new"
                                className="text-sky-600 hover:underline dark:text-sky-400"
                            >
                                /tenants/new
                            </Link>
                            .
                        </p>
                    ) : (
                        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {seedableTenants.map((t) => (
                                <li key={String(t.tenantId)}>
                                    <Link
                                        href={`/admin/seed/${t.tenantId}?step=1`}
                                        className="block rounded-md border p-3 transition hover:bg-accent/40"
                                    >
                                        <p className="text-sm font-medium">
                                            {t.displayName}
                                        </p>
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {String(t.tenantId)}
                                        </p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

function StatTile({ label, value }: { label: string; value: number }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
                {value}
            </CardContent>
        </Card>
    );
}
