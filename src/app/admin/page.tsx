import Link from 'next/link';
import { readModels } from '@/sorc';
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
    const [users, tenants, allMemberships, allActivity] = await Promise.all([
        listAuthUsers(1000),
        readModels.tenants.find({}),
        readModels.memberships.find({}),
        readModels.adminActivity.find({}),
    ]);

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
    void allMemberships; // (intentionally unused — kept for symmetry / future stat)

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
