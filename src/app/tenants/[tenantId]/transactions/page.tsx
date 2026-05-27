import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    recordTransactionAction,
    recordTransferAction,
} from '@/server/transactions';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { FilterTabs } from '@/components/filter-tabs';
import { ReceiptIcon } from 'lucide-react';
import { formatMoney } from '@/lib/money';

type Params = { tenantId: string };
type SearchParams = {
    accountId?: string;
    categoryId?: string;
    transactionType?: string;
    from?: string;
    to?: string;
    page?: string;
};

const PAGE_SIZE = 50;

export default async function TransactionsListPage(props: {
    params: Promise<Params>;
    searchParams: Promise<SearchParams>;
}) {
    const { tenantId } = await props.params;
    const sp = await props.searchParams;
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const accounts = await readModels.accountsByTenant.find({ tenantId });
    const categories = await readModels.categoriesByTenant.find({ tenantId });
    const accountById = new Map(accounts.map((a) => [String(a.accountId), a]));
    const categoryById = new Map(
        categories.map((c) => [String(c.categoryId), c]),
    );

    // Filter the full per-tenant set in-memory (Wave-C MVP scale).
    const all = await readModels.transactions.find({ tenantId });
    const filtered = all
        .filter((t) => !t.isDeleted)
        .filter((t) =>
            sp.accountId ? String(t.accountId) === sp.accountId : true,
        )
        .filter((t) =>
            sp.categoryId
                ? String(t.categoryId ?? '') === sp.categoryId
                : true,
        )
        .filter((t) =>
            sp.transactionType ? t.transactionType === sp.transactionType : true,
        )
        .filter((t) => (sp.from ? t.occurredOn >= sp.from : true))
        .filter((t) => (sp.to ? t.occurredOn <= sp.to : true))
        .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));

    const page = Math.max(1, Number(sp.page ?? '1') || 1);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canRecord = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin' || m.role === 'member',
    );

    const record = recordTransactionAction.bind(null, tenantId);
    const transfer = recordTransferAction.bind(null, tenantId);

    function buildHref(overrides: Partial<SearchParams>): string {
        const qs = new URLSearchParams();
        const merged: SearchParams = { ...sp, ...overrides };
        for (const [k, v] of Object.entries(merged)) {
            if (v) qs.set(k, String(v));
        }
        const s = qs.toString();
        return `/tenants/${tenantId}/transactions${s ? `?${s}` : ''}`;
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Transactions' },
                ]}
            />
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Transactions
                    </h1>
                    <p className="text-muted-foreground">
                        Tenant:{' '}
                        <Link
                            href={`/tenants/${tenantId}`}
                            className="hover:underline"
                        >
                            {tenant.displayName}
                        </Link>
                    </p>
                </div>
            </header>

            <FilterTabs
                tabs={[
                    {
                        label: 'All',
                        href: buildHref({ transactionType: undefined }),
                        active: !sp.transactionType,
                    },
                    {
                        label: 'Income',
                        href: buildHref({ transactionType: 'income' }),
                        active: sp.transactionType === 'income',
                    },
                    {
                        label: 'Expense',
                        href: buildHref({ transactionType: 'expense' }),
                        active: sp.transactionType === 'expense',
                    },
                    {
                        label: 'Transfer',
                        href: buildHref({ transactionType: 'transfer' }),
                        active: sp.transactionType === 'transfer',
                    },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        method="get"
                        className="grid gap-3 sm:grid-cols-2 md:grid-cols-5"
                    >
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="accountId">Account</Label>
                            <select
                                id="accountId"
                                name="accountId"
                                defaultValue={sp.accountId ?? ''}
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                            >
                                <option value="">All</option>
                                {accounts.map((a) => (
                                    <option
                                        key={String(a.accountId)}
                                        value={String(a.accountId)}
                                    >
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="categoryId">Category</Label>
                            <select
                                id="categoryId"
                                name="categoryId"
                                defaultValue={sp.categoryId ?? ''}
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                            >
                                <option value="">All</option>
                                {categories.map((c) => (
                                    <option
                                        key={String(c.categoryId)}
                                        value={String(c.categoryId)}
                                    >
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="transactionType">Type</Label>
                            <select
                                id="transactionType"
                                name="transactionType"
                                defaultValue={sp.transactionType ?? ''}
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                            >
                                <option value="">All</option>
                                <option value="income">income</option>
                                <option value="expense">expense</option>
                                <option value="transfer">transfer</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="from">From</Label>
                            <Input
                                id="from"
                                name="from"
                                type="date"
                                defaultValue={sp.from ?? ''}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="to">To</Label>
                            <Input
                                id="to"
                                name="to"
                                type="date"
                                defaultValue={sp.to ?? ''}
                            />
                        </div>
                        <div className="sm:col-span-2 md:col-span-5">
                            <Button type="submit">Apply</Button>
                            <Link
                                href={`/tenants/${tenantId}/transactions`}
                                className="ml-3 text-sm text-muted-foreground hover:underline"
                            >
                                Clear
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ledger ({filtered.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {pageRows.length === 0 ? (
                        <EmptyState
                            icon={<ReceiptIcon />}
                            title="No transactions yet"
                            description={
                                canRecord
                                    ? 'Use the form below to record one.'
                                    : 'Ask an owner, admin, or member to record transactions.'
                            }
                        />
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-muted-foreground">
                                <tr className="border-b">
                                    <th className="px-2 py-2 text-left">
                                        Date
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Description
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Account
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Category
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Type
                                    </th>
                                    <th className="px-2 py-2 text-right">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((t) => {
                                    const acc = accountById.get(
                                        String(t.accountId),
                                    );
                                    const cat = t.categoryId
                                        ? categoryById.get(String(t.categoryId))
                                        : null;
                                    const sign =
                                        t.transactionType === 'income' ? '+' : '−';
                                    return (
                                        <tr
                                            key={String(t.transactionId)}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="px-2 py-2 font-mono text-xs">
                                                {t.occurredOn}
                                            </td>
                                            <td className="px-2 py-2">
                                                <Link
                                                    href={`/tenants/${tenantId}/transactions/${t.transactionId}`}
                                                    className="hover:underline"
                                                >
                                                    {t.description ?? '—'}
                                                </Link>
                                            </td>
                                            <td className="px-2 py-2">
                                                {acc?.name ?? '?'}
                                            </td>
                                            <td className="px-2 py-2">
                                                {cat?.name ?? '—'}
                                            </td>
                                            <td className="px-2 py-2">
                                                <Badge variant="outline">
                                                    {t.transactionType}
                                                </Badge>
                                            </td>
                                            <td className="px-2 py-2 text-right font-mono tabular-nums">
                                                {t.transactionType === 'transfer'
                                                    ? formatMoney(
                                                          t.amount,
                                                          t.currency,
                                                      )
                                                    : `${sign}${formatMoney(t.amount, t.currency)}`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {totalPages > 1 ? (
                        <div className="mt-4 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                Page {page} of {totalPages}
                            </span>
                            <div className="flex gap-2">
                                {page > 1 ? (
                                    <Link
                                        href={buildHref({
                                            page: String(page - 1),
                                        })}
                                    >
                                        <Button variant="outline" size="sm">
                                            Previous
                                        </Button>
                                    </Link>
                                ) : null}
                                {page < totalPages ? (
                                    <Link
                                        href={buildHref({
                                            page: String(page + 1),
                                        })}
                                    >
                                        <Button variant="outline" size="sm">
                                            Next
                                        </Button>
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            {canRecord && accounts.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>New transaction</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            action={record}
                            className="grid gap-3 sm:grid-cols-2"
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="accountId">Account</Label>
                                <select
                                    id="accountId"
                                    name="accountId"
                                    required
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    {accounts
                                        .filter((a) => !a.isClosed)
                                        .map((a) => (
                                            <option
                                                key={String(a.accountId)}
                                                value={String(a.accountId)}
                                            >
                                                {a.name} ({a.currency})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="categoryId">Category</Label>
                                <select
                                    id="categoryId"
                                    name="categoryId"
                                    defaultValue=""
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="">(none)</option>
                                    {categories
                                        .filter((c) => !c.isArchived)
                                        .map((c) => (
                                            <option
                                                key={String(c.categoryId)}
                                                value={String(c.categoryId)}
                                            >
                                                {c.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="transactionType">Type</Label>
                                <select
                                    id="transactionType"
                                    name="transactionType"
                                    defaultValue="expense"
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="income">income</option>
                                    <option value="expense">expense</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="occurredOn">Date</Label>
                                <Input
                                    id="occurredOn"
                                    name="occurredOn"
                                    type="date"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="description">
                                    Description
                                </Label>
                                <Input
                                    id="description"
                                    name="description"
                                    placeholder="Grocery store"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Button type="submit">Record</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            {canRecord && accounts.filter((a) => !a.isClosed).length >= 2 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>New transfer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-3 text-xs text-muted-foreground">
                            MVP: same-currency transfers only. Two
                            transactions are recorded — one debit on the
                            source account, one credit on the destination.
                        </p>
                        <form
                            action={transfer}
                            className="grid gap-3 sm:grid-cols-2"
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="fromAccountId">From</Label>
                                <select
                                    id="fromAccountId"
                                    name="fromAccountId"
                                    required
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    {accounts
                                        .filter((a) => !a.isClosed)
                                        .map((a) => (
                                            <option
                                                key={String(a.accountId)}
                                                value={String(a.accountId)}
                                            >
                                                {a.name} ({a.currency})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="toAccountId">To</Label>
                                <select
                                    id="toAccountId"
                                    name="toAccountId"
                                    required
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    {accounts
                                        .filter((a) => !a.isClosed)
                                        .map((a) => (
                                            <option
                                                key={String(a.accountId)}
                                                value={String(a.accountId)}
                                            >
                                                {a.name} ({a.currency})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="transfer-amount">Amount</Label>
                                <Input
                                    id="transfer-amount"
                                    name="amount"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="transfer-occurredOn">
                                    Date
                                </Label>
                                <Input
                                    id="transfer-occurredOn"
                                    name="occurredOn"
                                    type="date"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="transfer-description">
                                    Description
                                </Label>
                                <Input
                                    id="transfer-description"
                                    name="description"
                                    placeholder="Rent payment"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Button type="submit">Transfer</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
