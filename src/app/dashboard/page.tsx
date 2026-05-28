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
import { dueDatesUpTo, nextDueOn } from '@/domains/recurring-templates';
import { materializeDueTemplates } from '@/lib/recurring-materialize';
import type { ActivityDoc } from '@/domains/activity';
import type { SorcUUID } from '@event-sorcerer/core';
import {
    CashflowForecastChart,
    IncomeExpenseBar,
    NetWorthLine,
    Sparkline,
    SpendingDonut,
    SpendingHeatmap,
} from './charts';
import { TenantFilter, type TenantFilterOption } from './tenant-filter';
import { PiggyBankIcon } from 'lucide-react';

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

export default async function DashboardPage({
    searchParams,
}: {
    searchParams?: Promise<{ tenantId?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/auth/signin?callbackUrl=/dashboard');
    }
    const sp = (await searchParams) ?? {};
    const requestedTenantId =
        sp.tenantId && sp.tenantId !== 'all' ? sp.tenantId : undefined;

    const userId = session.user.id as SorcUUID;
    // During impersonation `session.user.email` stays as the admin's
    // (visible identity in the top bar), but the dashboard renders the
    // target's world — invitations included. Resolve the effective
    // email from the impersonation envelope when present.
    const email =
        session.user.impersonation?.targetEmail ??
        session.user.email ??
        '';

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

    // ----- Generic dashboard data (cross-module) -----
    // Module install state per tenant — used by the "Workspaces" card
    // below to show what each tenant has installed, and gating the
    // module-grouped widget sections.
    const modulesByTenant = new Map<string, string[]>();
    let modulesInstalledTotal = 0;
    for (const tid of myTenantIds) {
        const docs = await readModels.tenantModules.find({ tenantId: tid });
        const active = docs
            .filter((d) => d.status === 'installed')
            .map((d) => d.moduleId);
        modulesByTenant.set(tid, active);
        modulesInstalledTotal += active.length;
    }
    const anyFinancesInstalled = Array.from(modulesByTenant.values()).some(
        (mods) => mods.includes('finances'),
    );

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

    // Tenant scope. `?tenantId=X` locks the per-tenant cards to that
    // one; otherwise "All tenants" mode aggregates across every tenant
    // the user belongs to (sums income/expense, unions categories,
    // concats budgets/recurring, etc). Net worth was already
    // currency-bucketed and ignores scope.
    const validatedRequestedTenantId =
        requestedTenantId && myTenantIdSet.has(requestedTenantId)
            ? requestedTenantId
            : undefined;
    const scopedTenantIds = validatedRequestedTenantId
        ? [validatedRequestedTenantId]
        : myTenantIds;
    const currentTenantId =
        validatedRequestedTenantId ?? myTenantIds[0];
    const isScopedToOneTenant = Boolean(validatedRequestedTenantId);
    const { key: ymKey, year, month } = currentYearMonth();

    // Merge this-month aggregates across the scope. byCategory is
    // keyed by categoryId — uuid collisions across tenants are
    // statistically impossible so a flat merge is safe.
    type MonthlyMerged = {
        income: number;
        expense: number;
        net: number;
        byCategory: Record<string, { income: number; expense: number }>;
    } | undefined;
    const monthlyAggs = await Promise.all(
        scopedTenantIds.map(async (tid) => {
            const [agg] = await readModels.monthlyAggregate.find({
                aggregateKey: `${tid}:${ymKey}`,
            });
            return agg;
        }),
    );
    const monthly: MonthlyMerged = monthlyAggs.some((a) => a)
        ? monthlyAggs.reduce<MonthlyMerged>((acc, m) => {
              if (!m) return acc;
              if (!acc) {
                  return {
                      income: m.income,
                      expense: m.expense,
                      net: m.net,
                      byCategory: { ...m.byCategory },
                  };
              }
              acc.income += m.income;
              acc.expense += m.expense;
              acc.net += m.net;
              for (const [k, v] of Object.entries(m.byCategory)) {
                  const prev = acc.byCategory[k] ?? {
                      income: 0,
                      expense: 0,
                  };
                  acc.byCategory[k] = {
                      income: prev.income + v.income,
                      expense: prev.expense + v.expense,
                  };
              }
              return acc;
          }, undefined)
        : undefined;

    const categories = (
        await Promise.all(
            scopedTenantIds.map((tid) =>
                readModels.categoriesByTenant.find({ tenantId: tid }),
            ),
        )
    ).flat();
    const categoryById = new Map(
        categories.map((c) => [String(c.categoryId), c]),
    );

    // "Top spending categories" is a SPENDING list — only expense-typed
    // categories should appear. Reverting an income transaction emits
    // an expense in the same income-typed category to nullify it; that
    // expense leaks into monthly.byCategory and used to show up here
    // (e.g. "Salary R$25,000" when a salary was reverted). Filter
    // those out by checking the category's declared type.
    const topSpending = monthly
        ? Object.entries(monthly.byCategory)
              .map(([catId, v]) => ({
                  categoryId: catId,
                  name:
                      catId === '__uncategorized'
                          ? 'Uncategorized'
                          : (categoryById.get(catId)?.name ?? 'Unknown'),
                  expense: v.expense,
                  // Uncategorized is implicitly "spending" when it shows
                  // up here (we already filter expense>0). Named
                  // categories must be type=expense to qualify.
                  isExpenseCategory:
                      catId === '__uncategorized'
                          ? true
                          : categoryById.get(catId)?.categoryType === 'expense',
              }))
              .filter((row) => row.expense > 0 && row.isExpenseCategory)
              .sort((a, b) => b.expense - a.expense)
              .slice(0, 5)
        : [];

    // ----- Savings rate (this month) -----
    const monthIncome = monthly?.income ?? 0;
    const monthExpense = monthly?.expense ?? 0;
    const monthNet = monthIncome - monthExpense;
    const savingsRate =
        monthIncome > 0 ? Math.max(-2, Math.min(2, monthNet / monthIncome)) : 0;

    // ----- Subscription cost (monthly-normalized total of active templates) -----
    // Cadence multipliers normalize each template's amount to a monthly
    // equivalent. The numbers are deliberate approximations (52/12 for
    // weekly, etc.) because "monthly equivalent of weekly" depends on
    // the month — for a dashboard KPI this is fine.
    const monthlyEquivalent = (cadence: { kind: string }, amount: number) => {
        switch (cadence.kind) {
            case 'daily':
                return amount * 30;
            case 'weekly':
                return amount * (52 / 12);
            case 'biweekly':
                return amount * (26 / 12);
            case 'monthly':
                return amount;
            case 'yearly':
                return amount / 12;
            default:
                return amount;
        }
    };

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
    // Cross-tenant: for each of the 6 months, sum income/expense
    // AND merge byCategory across every scoped tenant. Keeping the
    // per-category breakdown lets the trend-sparkline card below
    // reuse the same data without re-querying.
    const monthlyAggregates = await Promise.all(
        sixMonths.map(async ({ key }) => {
            const perTenant = await Promise.all(
                scopedTenantIds.map(async (tid) => {
                    const [agg] = await readModels.monthlyAggregate.find({
                        aggregateKey: `${tid}:${key}`,
                    });
                    return agg;
                }),
            );
            let totalIncome = 0;
            let totalExpense = 0;
            const byCategory: Record<
                string,
                { income: number; expense: number }
            > = {};
            for (const a of perTenant) {
                if (!a) continue;
                totalIncome += a.income;
                totalExpense += a.expense;
                for (const [k, v] of Object.entries(a.byCategory)) {
                    const prev = byCategory[k] ?? { income: 0, expense: 0 };
                    byCategory[k] = {
                        income: prev.income + v.income,
                        expense: prev.expense + v.expense,
                    };
                }
            }
            return {
                key,
                income: totalIncome,
                expense: totalExpense,
                byCategory,
            };
        }),
    );
    const incomeExpenseSeries = sixMonths.map((m, i) => {
        const a = monthlyAggregates[i]!;
        return {
            label: m.label,
            income: a.income,
            expense: a.expense,
        };
    });

    // Per-category trend: each expense-typed category gets a 6-month
    // mini-series of its expense totals. Sorted by current-month
    // amount desc; cap at the top 6 so the card stays readable.
    type CategoryTrend = {
        categoryId: string;
        name: string;
        currentMonth: number;
        series: Array<{ label: string; y: number }>;
    };
    const categoryTrendsAll: CategoryTrend[] = [];
    {
        const allCategoryIds = new Set<string>();
        for (const m of monthlyAggregates) {
            for (const k of Object.keys(m.byCategory)) allCategoryIds.add(k);
        }
        for (const catId of allCategoryIds) {
            const cat = categoryById.get(catId);
            // Skip income-typed categories on this card — it tracks
            // SPENDING trends only.
            if (cat && cat.categoryType !== 'expense') continue;
            const name =
                catId === '__uncategorized'
                    ? 'Uncategorized'
                    : (cat?.name ?? 'Unknown');
            const series = sixMonths.map((m, i) => ({
                label: m.label,
                y: monthlyAggregates[i]!.byCategory[catId]?.expense ?? 0,
            }));
            const currentMonth = series[series.length - 1]?.y ?? 0;
            if (currentMonth === 0 && series.every((p) => p.y === 0)) continue;
            categoryTrendsAll.push({
                categoryId: catId,
                name,
                currentMonth,
                series,
            });
        }
        categoryTrendsAll.sort((a, b) => b.currentMonth - a.currentMonth);
    }
    const categoryTrends = categoryTrendsAll.slice(0, 6);

    // ----- Donut: this-month spending by category -----
    // "Spending by category" — same filter as topSpending: skip
    // income-typed categories that have accidental expense balances
    // (revert-of-income emits an expense in the income category).
    const donutData = monthly
        ? Object.entries(monthly.byCategory)
              .map(([catId, v]) => ({
                  name:
                      catId === '__uncategorized'
                          ? 'Uncategorized'
                          : (categoryById.get(catId)?.name ?? 'Unknown'),
                  value: v.expense,
                  isExpenseCategory:
                      catId === '__uncategorized'
                          ? true
                          : categoryById.get(catId)?.categoryType === 'expense',
              }))
              .filter((row) => row.value > 0 && row.isExpenseCategory)
              .map(({ name, value }) => ({ name, value }))
        : [];

    // ----- Net-worth: last-12-months retrospective -----
    // Anchor today's net worth on the live accountBalance read model,
    // then walk monthlyAggregate backwards to derive past month-end
    // balances. net(month) = income - expense; transfers cancel out
    // so they don't affect totals.
    const liveNetWorth = accountBalances.reduce(
        (s, b) => s + b.balance,
        0,
    );
    const twelveMonths: Array<{ key: string; label: string }> = [];
    {
        const base = new Date(Date.UTC(year, month - 1, 1));
        for (let i = 11; i >= 0; i--) {
            const d = new Date(
                Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1),
            );
            const y = d.getUTCFullYear();
            const m = d.getUTCMonth() + 1;
            twelveMonths.push({
                key: `${y}-${String(m).padStart(2, '0')}`,
                label: d.toLocaleString(undefined, {
                    month: 'short',
                    timeZone: 'UTC',
                }),
            });
        }
    }
    // Cross-tenant: per-month net = sum over scoped tenants of
    // (income - expense). Transfers cancel within a tenant, so this
    // stays correct regardless of how many tenants are in scope.
    const twelveMonthAggs = await Promise.all(
        twelveMonths.map(async ({ key }) => {
            const perTenant = await Promise.all(
                scopedTenantIds.map(async (tid) => {
                    const [agg] = await readModels.monthlyAggregate.find({
                        aggregateKey: `${tid}:${key}`,
                    });
                    return agg;
                }),
            );
            return {
                key,
                net: perTenant.reduce(
                    (s, a) => s + ((a?.income ?? 0) - (a?.expense ?? 0)),
                    0,
                ),
            };
        }),
    );
    const netByMonth = twelveMonthAggs.map((m) => m.net);
    const netWorthSeries: Array<{ label: string; balance: number }> = [];
    {
        let running = liveNetWorth;
        // Walk newest → oldest: balance at end of month i = running.
        // For the current month (index 11), the live balance already
        // reflects that month's transactions, so we record it as-is.
        // For prior months we subtract that month's net.
        const seriesReverse: Array<{ label: string; balance: number }> = [];
        for (let i = twelveMonths.length - 1; i >= 0; i--) {
            seriesReverse.push({
                label: twelveMonths[i]!.label,
                balance: running,
            });
            running = running - netByMonth[i]!;
        }
        netWorthSeries.push(...seriesReverse.reverse());
    }

    // ----- Daily spending heatmap (~52 weeks back, aligned to Sunday) -----
    // Per-day totals AND a per-(day, category) breakdown so the hover
    // tooltip can list categories with their share. Uncategorized rows
    // surface under "Uncategorized" so the tooltip never says "Unknown".
    //
    // We align the START of the window to the Sunday 52 weeks before
    // the upcoming Saturday — that way the leftmost column is always a
    // complete 7-cell column and only the RIGHTMOST column may be
    // partial (today's incomplete week). GitHub does the same thing.
    const todayForHeatmap = new Date();
    todayForHeatmap.setUTCHours(0, 0, 0, 0);
    const daysToSaturday = 6 - todayForHeatmap.getUTCDay();
    const thisSaturday = new Date(todayForHeatmap);
    thisSaturday.setUTCDate(thisSaturday.getUTCDate() + daysToSaturday);
    const heatmapStart = new Date(thisSaturday);
    // 52 weeks - 1 day to land on the Sunday at the start of week 1.
    heatmapStart.setUTCDate(heatmapStart.getUTCDate() - 363);
    const heatmapDays =
        Math.round(
            (todayForHeatmap.getTime() - heatmapStart.getTime()) /
                (1000 * 60 * 60 * 24),
        ) + 1;
    type DayBuckets = { total: number; byCategory: Map<string, number> };
    const heatmapMap = new Map<string, DayBuckets>();
    for (let i = 0; i < heatmapDays; i++) {
        const d = new Date(heatmapStart);
        d.setUTCDate(heatmapStart.getUTCDate() + i);
        heatmapMap.set(d.toISOString().slice(0, 10), {
            total: 0,
            byCategory: new Map(),
        });
    }
    // Per-account 30-day net change. Same pass over transactions so
    // we don't fetch twice. accountDayNet: Map<accountId, Map<ymd, net>>
    const accountTrendDays = 30;
    const accountTrendStart = new Date(todayForHeatmap);
    accountTrendStart.setUTCDate(
        accountTrendStart.getUTCDate() - (accountTrendDays - 1),
    );
    const accountTrendYmds: string[] = [];
    const accountTrendRange = new Set<string>();
    for (let i = 0; i < accountTrendDays; i++) {
        const d = new Date(accountTrendStart);
        d.setUTCDate(accountTrendStart.getUTCDate() + i);
        const ymd = d.toISOString().slice(0, 10);
        accountTrendYmds.push(ymd);
        accountTrendRange.add(ymd);
    }
    const accountDayNet = new Map<string, Map<string, number>>();

    // Cross-tenant: pull transactions from every scoped tenant and
    // accumulate into the same per-day buckets — heatmap + per-account.
    for (const tid of scopedTenantIds) {
        const txs = await readModels.transactions.find({ tenantId: tid });
        for (const t of txs) {
            if (t.isDeleted) continue;
            // Heatmap: only expense rows.
            if (t.transactionType === 'expense') {
                const bucket = heatmapMap.get(t.occurredOn);
                if (bucket) {
                    bucket.total += t.amount;
                    const catName = t.categoryId
                        ? (categoryById.get(String(t.categoryId))?.name ??
                              'Unknown')
                        : 'Uncategorized';
                    bucket.byCategory.set(
                        catName,
                        (bucket.byCategory.get(catName) ?? 0) + t.amount,
                    );
                }
            }
            // Account trend: any in-window txn signed by type/direction.
            if (accountTrendRange.has(t.occurredOn)) {
                const sign =
                    t.transactionType === 'income'
                        ? 1
                        : t.transactionType === 'expense'
                          ? -1
                          : t.transferDirection === 'credit'
                            ? 1
                            : -1;
                const accId = String(t.accountId);
                let perDay = accountDayNet.get(accId);
                if (!perDay) {
                    perDay = new Map();
                    accountDayNet.set(accId, perDay);
                }
                perDay.set(
                    t.occurredOn,
                    (perDay.get(t.occurredOn) ?? 0) + sign * t.amount,
                );
            }
        }
    }
    const heatmapData = Array.from(heatmapMap.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([ymd, { total, byCategory }]) => ({
            ymd,
            expense: total,
            byCategory: Array.from(byCategory.entries())
                .map(([name, amount]) => ({ name, amount }))
                .sort((a, b) => b.amount - a.amount),
        }));

    // Resolve account names from the `accountsByTenant` read model
    // (accountBalance doesn't carry name) and build the 30-day balance
    // trend for each. Walking back from today's balance keeps the
    // arithmetic anchored on the live read-model value rather than
    // accumulating drift from event-log replay.
    const accountsByTenantDocs = (
        await Promise.all(
            scopedTenantIds.map((tid) =>
                readModels.accountsByTenant.find({ tenantId: tid }),
            ),
        )
    ).flat();
    const accountInfoById = new Map(
        accountsByTenantDocs.map((a) => [
            String(a.accountId),
            { name: a.name, isClosed: a.isClosed },
        ]),
    );
    type AccountTrend = {
        accountId: string;
        name: string;
        currency: string;
        balance: number;
        trend: Array<{ x: string; y: number }>;
    };
    const accountTrends: AccountTrend[] = accountBalances
        .filter((b) => !accountInfoById.get(String(b.accountId))?.isClosed)
        .map((b) => {
            const accId = String(b.accountId);
            const perDay = accountDayNet.get(accId) ?? new Map<string, number>();
            // Walk newest → oldest, recording each day's CLOSING balance,
            // then subtracting that day's net to step back. Reverse to
            // get oldest-first for the sparkline.
            let running = b.balance;
            const reverse: Array<{ x: string; y: number }> = [];
            for (let i = accountTrendDays - 1; i >= 0; i--) {
                const ymd = accountTrendYmds[i]!;
                reverse.push({ x: ymd, y: running });
                running -= perDay.get(ymd) ?? 0;
            }
            return {
                accountId: accId,
                name: accountInfoById.get(accId)?.name ?? 'Account',
                currency: b.currency,
                balance: b.balance,
                trend: reverse.reverse(),
            };
        })
        .sort((a, b) => b.balance - a.balance);

    // Cross-tenant: budgets + recurring are concatenated across every
    // scoped tenant. Single-tenant mode is just a list-of-one tenant
    // under the same path.
    const budgets = (
        await Promise.all(
            scopedTenantIds.map((tid) =>
                readModels.budgetsByTenant.find({ tenantId: tid }),
            ),
        )
    )
        .flat()
        .filter((b) => !b.isArchived);

    const recurring = (
        await Promise.all(
            scopedTenantIds.map((tid) =>
                readModels.recurringTemplates.find({ tenantId: tid }),
            ),
        )
    )
        .flat()
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
        .filter((t) => t.next !== null);
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

    // Currency-bucket awareness: when the user's accounts span more
    // than one currency, every aggregate widget below (This month,
    // Top spending, Budgets, Forecast, Subscriptions) is summing
    // mixed-currency amounts as if they were the same unit. We do
    // not do FX in MVP, so the safe fallback is: clearly mark
    // widgets that aren't currency-bucketed, and tell the user which
    // currency the numbers are being formatted as.
    const scopedAccountBalances = currentTenantId
        ? accountBalances.filter(
              (b) => String(b.tenantId) === currentTenantId,
          )
        : accountBalances;
    const scopedCurrencies = new Set(
        scopedAccountBalances.map((b) => b.currency),
    );
    const isMixedCurrency = scopedCurrencies.size > 1;

    // Subscription / recurring spend (monthly-normalized). Only counts
    // expense-type templates — income templates (e.g. salary) aren't
    // subscriptions.
    const monthlySubscriptionsTotal = recurring
        .filter((t) => t.transactionType === 'expense')
        .reduce(
            (sum, t) =>
                sum +
                monthlyEquivalent(
                    t.cadence as { kind: string },
                    t.amount,
                ),
            0,
        );

    // ----- Cash-flow forecast (next 60 days) -----
    // Walk each active recurring template forward and compute its due
    // dates up to today+60d. Sum (+income / -expense) into a per-day
    // delta map; running balance starts at the live net worth.
    const horizonDays = 60;
    const forecastStart = new Date();
    forecastStart.setUTCHours(0, 0, 0, 0);
    const forecastEnd = new Date(forecastStart);
    forecastEnd.setUTCDate(forecastEnd.getUTCDate() + horizonDays);
    const forecastEndYmd = forecastEnd.toISOString().slice(0, 10);
    const deltaByDay = new Map<string, number>();
    // Forecast iterates `recurring` which already spans every scoped
    // tenant (the templates loader above flattens across tenants).
    for (const t of recurring) {
        const due = dueDatesUpTo(
            t.cadence,
            t.startsOn,
            t.lastMaterializedOn,
            t.endsOn,
            forecastEndYmd,
        );
        for (const d of due) {
            if (d < forecastStart.toISOString().slice(0, 10)) continue;
            const sign = t.transactionType === 'income' ? 1 : -1;
            deltaByDay.set(d, (deltaByDay.get(d) ?? 0) + sign * t.amount);
        }
    }
    const forecastSeries: Array<{ label: string; balance: number }> = [];
    {
        let running = liveNetWorth;
        for (let i = 0; i <= horizonDays; i++) {
            const d = new Date(forecastStart);
            d.setUTCDate(forecastStart.getUTCDate() + i);
            const ymd = d.toISOString().slice(0, 10);
            running += deltaByDay.get(ymd) ?? 0;
            forecastSeries.push({
                label: d.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                }),
                balance: running,
            });
        }
    }

    // ----- existing activity feed -----
    // Tenant-scoped reads only — query per tenant and flatten. The
    // previous shape did `find({})` then post-filtered in memory,
    // which pulled cross-tenant rows into the request even though
    // they got dropped before render. Tightening here so an
    // unprivileged caller can never reach data outside their
    // memberships.
    const perTenantActivity = await Promise.all(
        myTenantIds.map((tid) =>
            readModels.activity.find({ tenantId: tid as SorcUUID }),
        ),
    );
    const allActivity = perTenantActivity.flat() as ActivityDoc[];
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

    const tenantFilterOptions: TenantFilterOption[] = activeTenants.map(
        ({ tenant }) => ({
            id: String(tenant.tenantId),
            displayName: tenant.displayName,
        }),
    );

    return (
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 md:p-8">
            <BreadcrumbBar items={[{ label: 'Dashboard' }]} />
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {isScopedToOneTenant
                            ? `Dashboard — ${currentTenant?.displayName ?? ''}`
                            : `Welcome back, ${greetingName}.`}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {activeTenants.length === 0
                            ? 'You don’t belong to any tenants yet — create one to get started.'
                            : isScopedToOneTenant
                              ? 'Showing data for one tenant. Switch via the filter.'
                              : `You’re a member of ${activeTenants.length} ${
                                    activeTenants.length === 1
                                        ? 'tenant'
                                        : 'tenants'
                                }.`}
                    </p>
                </div>
                <TenantFilter
                    options={tenantFilterOptions}
                    value={validatedRequestedTenantId}
                />
            </header>

            {isMixedCurrency ? (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    <span className="font-medium">Mixed currencies in scope</span>
                    <span className="text-amber-900/70 dark:text-amber-200/70">
                        Accounts span{' '}
                        {Array.from(scopedCurrencies).sort().join(', ')}. The
                        aggregate widgets below (This month, Top spending,
                        Budgets, Forecast) display values in{' '}
                        <span className="font-mono">{monthlyCurrency}</span>{' '}
                        and sum without FX conversion. Net worth is bucketed
                        per currency.
                    </span>
                </div>
            ) : null}

            {/* ---------- Generic widgets (cross-module) ---------- */}
            {activeTenants.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Overview
                        </h2>
                        <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Workspaces
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-3xl font-semibold">
                                {activeTenants.length}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Modules installed
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-3xl font-semibold">
                                {modulesInstalledTotal}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Pending invitations
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-3xl font-semibold">
                                {pendingInvitations.length}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Member since
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-base font-medium">
                                {tenureLabel === '—'
                                    ? '—'
                                    : `${tenureLabel} ago`}
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Workspaces summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="flex flex-col gap-2">
                                {activeTenants.map(({ tenant }) => {
                                    const tid = String(tenant.tenantId);
                                    const mods =
                                        modulesByTenant.get(tid) ?? [];
                                    return (
                                        <li
                                            key={tid}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                                        >
                                            <div className="flex flex-col">
                                                <Link
                                                    href={`/tenants/${tid}/dashboard`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {tenant.displayName}
                                                </Link>
                                                <span className="text-xs text-muted-foreground">
                                                    {tenant.defaultCurrency ??
                                                        'USD'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {mods.length === 0 ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        No modules
                                                    </span>
                                                ) : (
                                                    mods.map((m) => (
                                                        <Badge
                                                            key={m}
                                                            variant="outline"
                                                            className="text-[10px]"
                                                        >
                                                            {m}
                                                        </Badge>
                                                    ))
                                                )}
                                                <Link
                                                    href="/modules"
                                                    className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                                                >
                                                    Manage →
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </CardContent>
                    </Card>
                </section>
            ) : null}

            {/* ---------- Finances module widgets ---------- */}
            {activeTenants.length > 0 && anyFinancesInstalled ? (
                <div className="flex items-center gap-2">
                    <PiggyBankIcon className="size-4 text-muted-foreground" />
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Finances
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                </div>
            ) : null}

            {activeTenants.length > 0 && anyFinancesInstalled ? (
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

            {currentTenantId && accountTrends.length > 0 ? (
                <section>
                    <Card>
                        <CardHeader>
                            <CardTitle>Accounts</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Current balance · last 30 days
                            </p>
                        </CardHeader>
                        <CardContent>
                            <ul className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
                                {accountTrends.map((a) => {
                                    const sign =
                                        a.balance < 0 ? '−' : '';
                                    const display = formatMoney(
                                        Math.abs(a.balance),
                                        a.currency,
                                    );
                                    return (
                                        <li
                                            key={a.accountId}
                                            className="flex items-center gap-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">
                                                    {a.name}
                                                </p>
                                                <p className="font-mono tabular-nums text-xs text-muted-foreground">
                                                    {sign}
                                                    {display}
                                                </p>
                                            </div>
                                            <div className="w-24 shrink-0">
                                                <Sparkline
                                                    data={a.trend}
                                                />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </CardContent>
                    </Card>
                </section>
            ) : null}

            {currentTenantId ? (
                <>
                    <section>
                        <Card>
                            <CardHeader>
                                <CardTitle>Daily spending</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Last 52 weeks
                                </p>
                            </CardHeader>
                            <CardContent>
                                <SpendingHeatmap
                                    days={heatmapData}
                                    currency={monthlyCurrency}
                                    // Only thread the tenantId when the
                                    // dashboard is scoped to one tenant
                                    // — in "All tenants" mode the
                                    // "View in transactions" link target
                                    // is ambiguous, so suppress it.
                                    tenantId={
                                        isScopedToOneTenant
                                            ? currentTenantId
                                            : undefined
                                    }
                                />
                            </CardContent>
                        </Card>
                    </section>
                    {/* This-month detail — pair Top spending with the
                        Budget progress bars. Both answer "where is the
                        money going right now?". */}
                    {topSpending.length > 0 || budgets.length > 0 ? (
                        <section className="grid gap-4 md:grid-cols-2">
                            {topSpending.length > 0 ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Top spending categories
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            This month
                                        </p>
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
                            {budgets.length > 0 ? (
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
                                        <p className="text-xs text-muted-foreground">
                                            This month
                                        </p>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="flex flex-col gap-2 text-sm">
                                            {budgets.slice(0, 5).map((b) => {
                                                const cat = categoryById.get(
                                                    String(b.categoryId),
                                                );
                                                const effective =
                                                    b.monthlyAmount +
                                                    b.currentMonth
                                                        .rolloverBalance;
                                                const pct =
                                                    effective === 0
                                                        ? 0
                                                        : Math.min(
                                                              100,
                                                              (b.currentMonth
                                                                  .spent /
                                                                  effective) *
                                                                  100,
                                                          );
                                                const over =
                                                    b.currentMonth.spent >
                                                    effective;
                                                return (
                                                    <li
                                                        key={String(
                                                            b.budgetId,
                                                        )}
                                                        className="flex flex-col gap-1"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span>
                                                                {cat?.name ??
                                                                    'Unknown'}
                                                            </span>
                                                            <span className="font-mono tabular-nums">
                                                                {formatMoney(
                                                                    b
                                                                        .currentMonth
                                                                        .spent,
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
                                                                style={{
                                                                    width: `${pct}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </CardContent>
                                </Card>
                            ) : null}
                        </section>
                    ) : null}
                    {categoryTrends.length > 0 ? (
                        <section>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Category trends</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Last 6 months — top {categoryTrends.length} expense categories by current-month
                                        spend
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <ul className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                                        {categoryTrends.map((c) => (
                                            <li
                                                key={c.categoryId}
                                                className="flex items-center gap-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm">
                                                        {c.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatMoney(
                                                            c.currentMonth,
                                                            monthlyCurrency,
                                                        )}{' '}
                                                        · this month
                                                    </p>
                                                </div>
                                                <div className="w-24 shrink-0">
                                                    <Sparkline
                                                        data={c.series.map(
                                                            (p) => ({
                                                                x: p.label,
                                                                y: p.y,
                                                            }),
                                                        )}
                                                    />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </section>
                    ) : null}
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
                    <section>
                        <Card>
                            <CardHeader>
                                <CardTitle>Net worth</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Last 12 months
                                </p>
                            </CardHeader>
                            <CardContent>
                                <NetWorthLine
                                    data={netWorthSeries}
                                    currency={monthlyCurrency}
                                />
                            </CardContent>
                        </Card>
                    </section>
                    <section>
                        <Card>
                            <CardHeader>
                                <CardTitle>Cash-flow forecast</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Next 60 days — projected from active
                                    recurring templates.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <CashflowForecastChart
                                    data={forecastSeries}
                                    currency={monthlyCurrency}
                                />
                            </CardContent>
                        </Card>
                    </section>
                </>
            ) : null}

{/* topSpending + budgets cards moved up next to the heatmap */}

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

{/* KPI strip moved up next to the hero net-worth/this-month tiles */}

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
