import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

import type { ActivityDoc } from '@/domains/activity';

const TENANT_GRID_LIMIT = 6;
const RECENT_ACTIVITY_LIMIT = 10;

function formatRelative(d: Date): string {
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    return d.toLocaleDateString();
}

function StatTile({
    label,
    value,
    hint,
}: {
    label: string;
    value: string | number;
    hint?: string;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-semibold">{value}</div>
                {hint ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                        {hint}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function daysSince(date: Date): number {
    return Math.max(
        1,
        Math.floor(
            (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
        ),
    );
}

const roleVariant: Record<
    'owner' | 'admin' | 'member' | 'viewer',
    'default' | 'secondary' | 'outline'
> = {
    owner: 'default',
    admin: 'default',
    member: 'secondary',
    viewer: 'outline',
};

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/auth/signin?callbackUrl=/dashboard');
    }

    const userId = session.user.id;
    const email = session.user.email ?? '';

    const [allMemberships, invitationsByEmail] = await Promise.all([
        readModels.memberships.find({ userId }),
        email
            ? readModels.memberships.find({ invitedEmail: email })
            : Promise.resolve([]),
    ]);
    const memberships = allMemberships.filter((m) => !m.removedAt);
    const pendingInvitations = invitationsByEmail.filter(
        (m) => !m.userId && !m.removedAt,
    );

    const tenantCards = (
        await Promise.all(
            memberships.map(async (m) => {
                const tenant = (
                    await readModels.tenants.find({ tenantId: m.tenantId })
                )[0];
                return tenant ? { tenant, membership: m } : null;
            }),
        )
    ).filter((x): x is NonNullable<typeof x> => x !== null);

    const activeTenants = tenantCards.filter(
        ({ tenant }) => !tenant.archivedAt,
    );

    const tenantsById = new Map<
        string,
        (typeof tenantCards)[number]['tenant']
    >();
    for (const { tenant } of tenantCards) {
        tenantsById.set(String(tenant.tenantId), tenant);
    }

    const invitationTenants = await Promise.all(
        pendingInvitations
            .filter((m) => !tenantsById.has(String(m.tenantId)))
            .map(async (m) => {
                const t = (
                    await readModels.tenants.find({ tenantId: m.tenantId })
                )[0];
                return t ?? null;
            }),
    );
    for (const t of invitationTenants) {
        if (t) tenantsById.set(String(t.tenantId), t);
    }

    // Recent activity comes from the dedicated cross-domain `activity`
    // read model (one doc per published event). Filter to events scoped to
    // tenants the user belongs to.
    const myTenantIds = new Set(
        activeTenants.map(({ tenant }) => String(tenant.tenantId)),
    );
    const allActivity = (await readModels.activity.find({})) as ActivityDoc[];
    const recentActivity = allActivity
        .filter(
            (a) => !a.tenantId || myTenantIds.has(String(a.tenantId)),
        )
        .sort(
            (a, b) =>
                new Date(b.occurredAt).getTime() -
                new Date(a.occurredAt).getTime(),
        )
        .slice(0, RECENT_ACTIVITY_LIMIT);

    const ownedOrAdminCount = activeTenants.filter(
        ({ membership }) =>
            membership.role === 'owner' || membership.role === 'admin',
    ).length;

    const oldestJoin = activeTenants.reduce<Date | null>((earliest, t) => {
        const joined = t.membership.joinedAt;
        if (!joined) return earliest;
        const d = new Date(joined);
        return !earliest || d < earliest ? d : earliest;
    }, null);

    const oldestJoinHint = oldestJoin
        ? `Member since ${oldestJoin.toLocaleDateString()}`
        : 'No accepted memberships yet';

    const tenureLabel = oldestJoin ? `${daysSince(oldestJoin)}d` : '—';

    const isAdmin = session.user.isAdmin === true;
    const greetingName =
        session.user.name ?? session.user.email ?? 'there';
    const sortedTenants = [...activeTenants].sort((a, b) => {
        const at = new Date(a.tenant.createdAt).getTime();
        const bt = new Date(b.tenant.createdAt).getTime();
        return bt - at;
    });
    const visibleTenants = sortedTenants.slice(0, TENANT_GRID_LIMIT);
    const overflowCount = sortedTenants.length - visibleTenants.length;

    return (
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 md:p-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Welcome back, {greetingName}.
                </h1>
                <p className="text-sm text-muted-foreground">
                    {activeTenants.length === 0
                        ? 'You don’t belong to any tenants yet — create one to get started.'
                        : `You’re a member of ${activeTenants.length} ${
                              activeTenants.length === 1
                                  ? 'tenant'
                                  : 'tenants'
                          }.`}
                </p>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatTile
                    label="Active tenants"
                    value={activeTenants.length}
                />
                <StatTile
                    label="Where you manage"
                    value={ownedOrAdminCount}
                    hint="Tenants where you’re owner or admin"
                />
                <StatTile
                    label="Tenure"
                    value={tenureLabel}
                    hint={oldestJoinHint}
                />
            </section>

            {pendingInvitations.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <h2 className="text-lg font-medium">
                        Pending invitations
                    </h2>
                    <ul className="flex flex-col gap-2">
                        {pendingInvitations.map((m) => {
                            const tenant = tenantsById.get(String(m.tenantId));
                            return (
                                <li key={String(m.membershipId)}>
                                    <Card>
                                        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {tenant?.displayName ??
                                                        'Unknown tenant'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Invited as{' '}
                                                    <Badge
                                                        variant={
                                                            roleVariant[m.role]
                                                        }
                                                        className="capitalize"
                                                    >
                                                        {m.role}
                                                    </Badge>{' '}
                                                    ·{' '}
                                                    {formatRelative(
                                                        new Date(m.invitedAt),
                                                    )}
                                                </span>
                                            </div>
                                            {tenant ? (
                                                <Link
                                                    href={`/tenants/${tenant.tenantId}`}
                                                >
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        View
                                                    </Button>
                                                </Link>
                                            ) : null}
                                        </CardContent>
                                    </Card>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ) : null}

            {activeTenants.length === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Get started</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm">
                        <p className="text-muted-foreground">
                            Tenants are isolated workspaces. Every account,
                            transaction, and member lives inside one tenant.
                        </p>
                        <div>
                            <Link href="/tenants/new">
                                <Button>Create your first tenant</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-lg font-medium">Your tenants</h2>
                        <div className="flex gap-2">
                            <Link href="/tenants">
                                <Button variant="ghost" size="sm">
                                    View all
                                </Button>
                            </Link>
                            <Link href="/tenants/new">
                                <Button size="sm">New tenant</Button>
                            </Link>
                        </div>
                    </div>
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {visibleTenants.map(({ tenant, membership }) => (
                            <li key={String(tenant.tenantId)}>
                                <Link
                                    href={`/tenants/${tenant.tenantId}`}
                                    className="block h-full"
                                >
                                    <Card className="h-full transition-colors hover:bg-muted/40">
                                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                                            <CardTitle className="text-base">
                                                {tenant.displayName}
                                            </CardTitle>
                                            <Badge
                                                variant={
                                                    roleVariant[membership.role]
                                                }
                                            >
                                                {membership.role}
                                            </Badge>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                                            {tenant.description ? (
                                                <p className="line-clamp-2">
                                                    {tenant.description}
                                                </p>
                                            ) : (
                                                <p className="italic opacity-70">
                                                    No description.
                                                </p>
                                            )}
                                            {membership.joinedAt ? (
                                                <p className="text-xs">
                                                    Joined{' '}
                                                    {new Date(
                                                        membership.joinedAt,
                                                    ).toLocaleDateString()}
                                                </p>
                                            ) : null}
                                        </CardContent>
                                    </Card>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {overflowCount > 0 ? (
                        <p className="text-sm text-muted-foreground">
                            +{overflowCount} more —{' '}
                            <Link
                                href="/tenants"
                                className="underline underline-offset-4 hover:text-foreground"
                            >
                                see all
                            </Link>
                        </p>
                    ) : null}
                </section>
            )}

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium">Recent activity</h2>
                {recentActivity.length === 0 ? (
                    <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                            No activity in your tenants yet.
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <ul className="divide-y">
                                {recentActivity.map((row) => {
                                    const tenantName = row.tenantId
                                        ? tenantsById.get(String(row.tenantId))
                                              ?.displayName
                                        : undefined;
                                    const at = new Date(row.occurredAt);
                                    return (
                                        <li
                                            key={row.eventId}
                                            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                                        >
                                            <div className="flex min-w-0 flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant={
                                                            row.domain ===
                                                            'admin'
                                                                ? 'secondary'
                                                                : 'outline'
                                                        }
                                                    >
                                                        {row.domain}
                                                    </Badge>
                                                    <span className="truncate">
                                                        {row.summary}
                                                    </span>
                                                </div>
                                                {tenantName && row.tenantId ? (
                                                    <Link
                                                        href={`/tenants/${row.tenantId}`}
                                                        className="truncate text-xs text-muted-foreground hover:text-foreground"
                                                    >
                                                        {tenantName}
                                                    </Link>
                                                ) : null}
                                            </div>
                                            <span
                                                className="shrink-0 text-xs text-muted-foreground"
                                                title={at.toISOString()}
                                            >
                                                {formatRelative(at)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </CardContent>
                    </Card>
                )}
            </section>

            {isAdmin ? (
                <section>
                    <Card className="border-dashed">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Admin tools
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2 text-sm">
                            <Link href="/admin">
                                <Button variant="outline" size="sm">
                                    Admin dashboard
                                </Button>
                            </Link>
                            <Link href="/admin/users">
                                <Button variant="outline" size="sm">
                                    Users
                                </Button>
                            </Link>
                            <Link href="/admin/audit-log">
                                <Button variant="outline" size="sm">
                                    Audit log
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </section>
            ) : null}
        </main>
    );
}
