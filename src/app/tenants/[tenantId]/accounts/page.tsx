import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { createAccountAction } from '@/server/accounts';
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
import { WalletIcon } from 'lucide-react';
import { formatMoney } from '@/lib/money';

type Params = { tenantId: string };
type SearchParams = { view?: string };

type AccountView = 'all' | 'archived' | 'closed';

function parseView(raw?: string): AccountView {
    if (raw === 'archived' || raw === 'closed') return raw;
    return 'all';
}

export default async function AccountsListPage(props: {
    params: Promise<Params>;
    searchParams: Promise<SearchParams>;
}) {
    const { tenantId } = await props.params;
    const sp = await props.searchParams;
    const view = parseView(sp.view);
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const accounts = await readModels.accountsByTenant.find({ tenantId });
    const balances = await readModels.accountBalance.find({ tenantId });
    const balanceByAccount = new Map(
        balances.map((b) => [String(b.accountId), b]),
    );

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canManage = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin',
    );

    const create = createAccountAction.bind(null, tenantId);

    const counts = {
        all: accounts.filter((a) => !a.isClosed && !a.isArchived).length,
        archived: accounts.filter((a) => a.isArchived && !a.isClosed).length,
        closed: accounts.filter((a) => a.isClosed).length,
    };
    const visible = accounts
        .filter((a) => {
            if (view === 'closed') return a.isClosed;
            if (view === 'archived') return a.isArchived && !a.isClosed;
            return !a.isClosed && !a.isArchived;
        })
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Accounts' },
                ]}
            />
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Accounts
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
                        label: 'Active',
                        href: `/tenants/${tenantId}/accounts`,
                        active: view === 'all',
                        count: counts.all,
                    },
                    {
                        label: 'Archived',
                        href: `/tenants/${tenantId}/accounts?view=archived`,
                        active: view === 'archived',
                        count: counts.archived,
                    },
                    {
                        label: 'Closed',
                        href: `/tenants/${tenantId}/accounts?view=closed`,
                        active: view === 'closed',
                        count: counts.closed,
                    },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Your accounts</CardTitle>
                </CardHeader>
                <CardContent>
                    {visible.length === 0 ? (
                        <EmptyState
                            icon={<WalletIcon />}
                            title="No accounts yet"
                            description={
                                canManage
                                    ? 'Create one with the form below.'
                                    : 'Ask an owner or admin to create one.'
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {visible.map((a) => {
                                const bal = balanceByAccount.get(
                                    String(a.accountId),
                                );
                                return (
                                    <li key={String(a.accountId)}>
                                        <Link
                                            href={`/tenants/${tenantId}/accounts/${a.accountId}`}
                                            className="flex items-center justify-between gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                        >
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate font-medium">
                                                    {a.name}
                                                </span>
                                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Badge variant="outline">
                                                        {a.accountType}
                                                    </Badge>
                                                    {a.isArchived ? (
                                                        <Badge variant="secondary">
                                                            archived
                                                        </Badge>
                                                    ) : null}
                                                </span>
                                            </div>
                                            <span className="font-mono text-sm tabular-nums">
                                                {formatMoney(
                                                    bal?.balance ??
                                                        a.openingBalance,
                                                    a.currency,
                                                )}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Create account</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            action={create}
                            className="grid gap-3 sm:grid-cols-2"
                        >
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    maxLength={120}
                                    placeholder="Everyday checking"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="accountType">Type</Label>
                                <select
                                    id="accountType"
                                    name="accountType"
                                    defaultValue="checking"
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="checking">checking</option>
                                    <option value="savings">savings</option>
                                    <option value="credit">credit</option>
                                    <option value="cash">cash</option>
                                    <option value="investment">
                                        investment
                                    </option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="currency">Currency</Label>
                                <Input
                                    id="currency"
                                    name="currency"
                                    required
                                    defaultValue="USD"
                                    maxLength={3}
                                    pattern="[A-Za-z]{3}"
                                    className="uppercase"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="openingBalance">
                                    Opening balance
                                </Label>
                                <Input
                                    id="openingBalance"
                                    name="openingBalance"
                                    type="text"
                                    inputMode="decimal"
                                    defaultValue="0"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Button type="submit">Create account</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
