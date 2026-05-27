import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { formatMoney } from '@/lib/money';
import { nextDueOn } from '@/domains/recurring-templates';
import { materializeDueTemplates } from '@/lib/recurring-materialize';
import type { ActivityDoc } from '@/domains/activity';
import type { SorcUUID } from '@event-sorcerer/core';
import { IncomeExpenseBar, SpendingDonut } from './charts';

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
        Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
    );
}

function currentYearMonth(): { year: number; month: number; key: string } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    return {
        year,
        month,
        key: `${year}-${String(month).padStart(2, '0')}`,
    };
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

    const userId = session.user.id as SorcUUID;
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

    const myTenantIds = activeTenants.map(({ tenant }) =>
        String(tenant.tenantId),
    );
    const myTenantIdSet = new Set(myTenantIds);

    // Fire-and-forget materialize for each tenant the user belongs to.
    // Errors are swallowed inside the helper.
    for (const tid of myTenantIds) {
        try {
            await materializeDueTemplates(tid, userId);
        } catch (err) {
            console.error('[dashboard] materialize side-effect', { tid, err });
        }
    }

    // ----- finance roll-ups -----

    const accountBalances = (
        await Promise.all(
            myTenantIds.map((tid) =>
                readModels.accountBalance.find({ tenantId: tid }),
            ),
        )
    ).flat();

    // Net worth grouped by currency (no FX).
    const netWorthByCurrency = new Map<string, number>();
    for (const b of accountBalances) {
        netWorthByCurrency.set(
            b.currency,
            (netWorthByCurrency.get(b.currency) ?? 0) + b.balance,
        );
    }

    // Pick a "current" tenant for this-month + spending — first one for now.
    const currentTenantId = myTenantIds[0];
    const { key: ymKey, year, month } = currentYearMonth();
    const monthly = currentTenantId
        ? (
              await readModels.monthlyAggregate.find({
                  aggregateKey: `${currentTenantId}:${ymKey}`,
              })
          )[0]
        : undefined;

    const categories = currentTenantId
        ? await readModels.categoriesByTenant.find({
              tenantId: currentTenantId,
          })
        : [];
    const categoryById = new Map(
        categories.map((c) => [String(c.categoryId), c]),
    );

    const topSpending = monthly
        ? Object.entries(monthly.byCategory)
              .map(([catId, v]) => ({
                  categoryId: catId,
                  name:
                      catId === '__uncategorized'
                          ? 'Uncategorized'
                          : (categoryById.get(catId)?.name ?? 'Unknown'),
                  expense: v.expense,
              }))
              .filter((row) => row.expense > 0)
              .sort((a, b) => b.expense - a.expense)
              .slice(0, 5)
        : [];

    // ----- Last-6-months income vs expense (bar chart) -----
    // Walk back month-by-month and join with monthlyAggregate. Months
    // with no events render as 0/0 — keeps the x-axis at a fixed width.
    const sixMonths: Array<{ key: string; label: string }> = [];
    {
        const start = new Date(Date.UTC(year, month - 1, 1));
        for (let i = 5; i >= 0; i--) {
            const d = new Date(
                Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - i, 1),
            );
            const y = d.getUTCFullYear();
            const m = d.getUTCMonth() + 1;
            sixMonths.push({
                key: `${y}-${String(m).padStart(2, '0')}`,
                label: d.toLocaleString(undefined, {
                    month: 'short',
                    year: '2-digit',
                    timeZone: 'UTC',
                }),
            });
        }
    }
    const monthlyAggregates = currentTenantId
        ? await Promise.all(
              sixMonths.map(async ({ key }) => {
                  const [agg] = await readModels.monthlyAggregate.find({
                      aggregateKey: `${currentTenantId}:${key}`,
                  });
                  return { key, agg };
              }),
          )
        : [];
    const incomeExpenseSeries = sixMonths.map((m, i) => {
        const agg = monthlyAggregates[i]?.agg;
        return {
            label: m.label,
            income: agg?.income ?? 0,
            expense: agg?.expense ?? 0,
        };
    });

    // ----- Donut: this-month spending by category -----
    const donutData = monthly
        ? Object.entries(monthly.byCategory)
              .map(([catId, v]) => ({
                  name:
                      catId === '__uncategorized'
                          ? 'Uncategorized'
                          : (categoryById.get(catId)?.name ?? 'Unknown'),
                  value: v.expense,
              }))
              .filter((row) => row.value > 0)
        : [];

    const budgets = currentTenantId
        ? (
              await readModels.budgetsByTenant.find({
                  tenantId: currentTenantId,
              })
          ).filter((b) => !b.isArchived)
        : [];

    const recurring = currentTenantId
        ? (
              await readModels.recurringTemplates.find({
                  tenantId: currentTenantId,
              })
          )
              .filter((t) => !t.isArchived)
              .map((t) => ({
                  ...t,
                  next: nextDueOn(
                      t.cadence,
                      t.startsOn,
                      t.lastMaterializedOn,
                      t.endsOn,
                  ),
              }))
              .filter((t) => t.next !== null)
        : [];
    const today = new Date().toISOString().slice(0, 10);
    const sevenDays = new Date();
    sevenDays.setUTCDate(sevenDays.getUTCDate() + 7);
    const sevenDaysYmd = sevenDays.toISOString().slice(0, 10);
    const upcomingRecurring = recurring
        .filter((t) => t.next && t.next <= sevenDaysYmd && t.next >= today)
        .sort((a, b) => (a.next! < b.next! ? -1 : 1))
        .slice(0, 5);

    const monthlyCurrency =
        budgets[0]?.currency ?? accountBalances[0]?.currency ?? 'USD';

    // ----- existing activity feed -----
    const allActivity = (await readModels.activity.find({})) as ActivityDoc[];
    const recentActivity = allActivity
        .filter((a) => !a.tenantId || myTenantIdSet.has(String(a.tenantId)))
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
    const greetingName = session.user.name ?? session.user.email ?? 'there';
    const sortedTenants = [...activeTenants].sort((a, b) => {
        const at = new Date(a.tenant.createdAt).getTime();
        const bt = new Date(b.tenant.createdAt).getTime();
        return bt - at;
    });
    const visibleTenants = sortedTenants.slice(0, TENANT_GRID_LIMIT);
    const overflowCount = sortedTenants.length - visibleTenants.length;
    const currentTenant = currentTenantId
        ? tenantsById.get(currentTenantId)
        : undefined;

    return (
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 md:p-8">
            <BreadcrumbBar items={[{ label: 'Dashboard' }]} />
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

            {activeTenants.length > 0 ? (
                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Net worth
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            {netWorthByCurrency.size === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No accounts yet.
                                </p>
                            ) : (
                                Array.from(netWorthByCurrency.entries()).map(
                                    ([currency, total]) => (
                                        <div
                                            key={currency}
                                            className="flex items-baseline justify-between"
                                        >
                                            <span className="text-xs text-muted-foreground">
                                                {currency}
                                            </span>
                                            <span className="font-mono text-2xl tabular-nums">
                                                {formatMoney(total, currency)}
                                            </span>
                                        </div>
                                    ),
                                )
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                This month
                                {currentTenant ? (
                                    <span className="ml-2 font-normal">
                                        ·{' '}
                                        <Link
                                            href={`/tenants/${currentTenantId}`}
                                            className="hover:underline"
                                        >
                                            {currentTenant.displayName}
                                        </Link>
                                    </span>
                                ) : null}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">
                                        Income
                                    </span>
                                    <span className="font-mono tabular-nums">
                                        {formatMoney(
                                            monthly?.income ?? 0,
                                            monthlyCurrency,
                                        )}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">
                                        Expense
                                    </span>
                                    <span className="font-mono tabular-nums">
                                        {formatMoney(
                                            monthly?.expense ?? 0,
                                            monthlyCurrency,
                                        )}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">
                                        Net
                                    </span>
                                    <span
                                        className={`font-mono tabular-nums ${(monthly?.net ?? 0) < 0 ? 'text-destructive' : ''}`}
                                    >
                                        {formatMoney(
                                            monthly?.net ?? 0,
                                            monthlyCurrency,
                                        )}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                {year}-{String(month).padStart(2, '0')}
                            </div>
                        </CardContent>
                    </Card>
                </section>
            ) : null}

            {currentTenantId ? (
                <section className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Income vs expense</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Last 6 months
                            </p>
                        </CardHeader>
                        <CardContent>
                            <IncomeExpenseBar
                                data={incomeExpenseSeries}
                                currency={monthlyCurrency}
                            />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Spending by category</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                This month
                            </p>
                        </CardHeader>
                        <CardContent>
                            <SpendingDonut
                                data={donutData}
                                currency={monthlyCurrency}
                            />
                        </CardContent>
                    </Card>
                </section>
            ) : null}

            {currentTenantId && topSpending.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Top spending categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="flex flex-col gap-1.5 text-sm">
                            {topSpending.map((row) => (
                                <li
                                    key={row.categoryId}
                                    className="flex items-center justify-between"
                                >
                                    <span>{row.name}</span>
                                    <span className="font-mono tabular-nums">
                                        {formatMoney(
                                            row.expense,
                                            monthlyCurrency,
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            ) : null}

            {currentTenantId && budgets.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-baseline justify-between gap-2">
                            <span>Budgets</span>
                            <Link
                                href={`/tenants/${currentTenantId}/budgets`}
                                className="text-xs font-normal text-muted-foreground hover:underline"
                            >
                                All
                            </Link>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="flex flex-col gap-2 text-sm">
                            {budgets.slice(0, 5).map((b) => {
                                const cat = categoryById.get(
                                    String(b.categoryId),
                                );
                                const effective =
                                    b.monthlyAmount +
                                    b.currentMonth.rolloverBalance;
                                const pct =
                                    effective === 0
                                        ? 0
                                        : Math.min(
                                              100,
                                              (b.currentMonth.spent /
                                                  effective) *
                                                  100,
                                          );
                                const over = b.currentMonth.spent > effective;
                                return (
                                    <li
                                        key={String(b.budgetId)}
                                        className="flex flex-col gap-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>
                                                {cat?.name ?? 'Unknown'}
                                            </span>
                                            <span className="font-mono tabular-nums">
                                                {formatMoney(
                                                    b.currentMonth.spent,
                                                    b.currency,
                                                )}{' '}
                                                /{' '}
                                                {formatMoney(
                                                    effective,
                                                    b.currency,
                                                )}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={
                                                    over
                                                        ? 'h-1.5 bg-destructive'
                                                        : 'h-1.5 bg-primary'
                                                }
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </CardContent>
                </Card>
            ) : null}

            {currentTenantId && upcomingRecurring.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-baseline justify-between gap-2">
                            <span>Upcoming recurring (next 7 days)</span>
                            <Link
                                href={`/tenants/${currentTenantId}/recurring`}
                                className="text-xs font-normal text-muted-foreground hover:underline"
                            >
                                All
                            </Link>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="flex flex-col gap-1.5 text-sm">
                            {upcomingRecurring.map((t) => (
                                <li
                                    key={String(t.templateId)}
                                    className="flex items-center justify-between"
                                >
                                    <span className="truncate">
                                        {t.description ??
                                            '(no description)'}{' '}
                                        <Badge
                                            variant="outline"
                                            className="ml-2"
                                        >
                                            {t.transactionType}
                                        </Badge>
                                    </span>
                                    <span className="font-mono text-xs">
                                        {t.next}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            ) : null}

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
                            const tenant = tenantsById.get(
                                String(m.tenantId),
                            );
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
                                                            roleVariant[
                                                                m.role
                                                            ]
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
                        <h2 className="text-lg font-medium">
                            Your tenants
                        </h2>
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
                                                    roleVariant[
                                                        membership.role
                                                    ]
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
                                        ? tenantsById.get(
                                              String(row.tenantId),
                                          )?.displayName
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
                                                {tenantName &&
                                                row.tenantId ? (
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
