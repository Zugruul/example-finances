import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    recordTransactionAction,
    recordTransferAction,
    revertTransactionsAction,
} from '@/server/transactions';
import { applyTemplateAction } from '@/server/recurring';
import { nextDueOn, type Cadence } from '@/domains/recurring-templates';
import { TransactionsLedger, type LedgerRow } from './transactions-ledger';
import {
    QuickPickTemplates,
    type QuickPickTemplate,
} from './quick-pick-templates';
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
    /** When set, the New transaction form pre-fills from this template. */
    templateId?: string;
};

const PAGE_SIZE = 50;

function formatCadence(c: Cadence): string {
    switch (c.kind) {
        case 'daily':
            return 'daily';
        case 'weekly':
            return `weekly (day ${c.dayOfWeek})`;
        case 'biweekly':
            return `every 2 weeks (day ${c.dayOfWeek})`;
        case 'monthly':
            return `monthly (day ${c.dayOfMonth})`;
        case 'yearly':
            return `yearly (${c.month}/${c.dayOfMonth})`;
    }
}

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
    const revertAction = revertTransactionsAction.bind(null, tenantId);
    const applyTemplate = applyTemplateAction.bind(null, tenantId);

    // Pre-fill: when the user clicked a quick-pick card we land here with
    // ?templateId=<id>. Resolve the template (if it still exists and is
    // active) and compute the form defaults — same fields the user can
    // edit before submitting.
    const selectedTemplate =
        sp.templateId && sp.templateId.trim()
            ? (
                  await readModels.recurringTemplates.find({
                      templateId: sp.templateId.trim() as never,
                  })
              )[0]
            : null;
    const formAction = selectedTemplate ? applyTemplate : record;
    const formDefaults = (() => {
        if (!selectedTemplate) return null;
        if (String(selectedTemplate.tenantId) !== tenantId) return null;
        if (selectedTemplate.isArchived) return null;
        const tplAccount = accountById.get(
            String(selectedTemplate.accountId),
        );
        if (!tplAccount || tplAccount.isClosed) return null;
        const today = new Date().toISOString().slice(0, 10);
        const due = nextDueOn(
            selectedTemplate.cadence as Cadence,
            selectedTemplate.startsOn,
            selectedTemplate.lastMaterializedOn,
            selectedTemplate.endsOn,
        );
        // Amount comes back as minor-units (cents); the form expects a
        // human decimal string in the account currency.
        const major = (selectedTemplate.amount / 100).toFixed(2);
        return {
            templateId: String(selectedTemplate.templateId),
            accountId: String(selectedTemplate.accountId),
            categoryId: selectedTemplate.categoryId
                ? String(selectedTemplate.categoryId)
                : '',
            amount: major,
            occurredOn: due ?? today,
            description: selectedTemplate.description ?? '',
            transactionType: selectedTemplate.transactionType,
        };
    })();

    // Build quick-pick cards from active templates. The card shows the
    // next on-cadence due date (or "no upcoming date" for ended ones);
    // a `due` badge marks anything ≤ today.
    const today = new Date().toISOString().slice(0, 10);
    const templates = (
        await readModels.recurringTemplates.find({ tenantId })
    ).filter((t) => !t.isArchived);
    const quickPickTemplates: QuickPickTemplate[] = templates
        .map((t) => {
            const due = nextDueOn(
                t.cadence as Cadence,
                t.startsOn,
                t.lastMaterializedOn,
                t.endsOn,
            );
            const account = accountById.get(String(t.accountId));
            const cadenceLabel = formatCadence(t.cadence as Cadence);
            return {
                templateId: String(t.templateId),
                title: t.description ?? t.transactionType,
                transactionType: t.transactionType as 'income' | 'expense',
                amount: t.amount,
                currency: account?.currency ?? 'USD',
                accountName: account?.name ?? '?',
                nextDueOn: due,
                isDueNow: !!due && due <= today,
                cadenceLabel,
            };
        })
        // Hide templates whose accounts have been closed (would fail on apply).
        .filter((t) => {
            const account = accountById.get(
                templates.find((tt) => String(tt.templateId) === t.templateId)
                    ?.accountId
                    ? String(
                          templates.find(
                              (tt) => String(tt.templateId) === t.templateId,
                          )!.accountId,
                      )
                    : '',
            );
            return account && !account.isClosed;
        })
        // Surface due ones first, then by next due date.
        .sort((a, b) => {
            if (a.isDueNow !== b.isDueNow) return a.isDueNow ? -1 : 1;
            const ad = a.nextDueOn ?? '￿';
            const bd = b.nextDueOn ?? '￿';
            return ad < bd ? -1 : ad > bd ? 1 : 0;
        });

    // Note: for chain-state computation in the client ledger we need the
    // FULL filtered set (so reverts can be paired with their originals
    // even when both don't land on the same paginated page). We pass the
    // current page's rows for display, plus include any "chain children"
    // (reverts) of those rows from the broader filtered set so they
    // render under the right parent in Ledger mode.
    const pageIds = new Set(pageRows.map((r) => String(r.transactionId)));
    const chainChildren = filtered.filter((r) => {
        if (!r.revertsTransactionIds?.length) return false;
        if (pageIds.has(String(r.transactionId))) return false; // already in page
        return r.revertsTransactionIds.some((tid) => pageIds.has(String(tid)));
    });
    const ledgerRows: LedgerRow[] = [...pageRows, ...chainChildren].map((t) => {
        const acc = accountById.get(String(t.accountId));
        const cat = t.categoryId
            ? categoryById.get(String(t.categoryId))
            : null;
        return {
            transactionId: String(t.transactionId),
            accountId: String(t.accountId),
            accountName: acc?.name ?? '?',
            categoryName: cat?.name ?? null,
            amount: t.amount,
            currency: t.currency,
            occurredOn: t.occurredOn,
            description: t.description ?? null,
            transactionType: t.transactionType,
            transferDirection: t.transferDirection,
            revertsTransactionIds: t.revertsTransactionIds?.map(String),
            recordedAtIso:
                t.recordedAt instanceof Date
                    ? t.recordedAt.toISOString()
                    : new Date(t.recordedAt as any).toISOString(),
        };
    });

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
                        <TransactionsLedger
                            tenantId={tenantId}
                            rows={ledgerRows}
                            canRecord={canRecord}
                            revertAction={revertAction}
                        />
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

            {canRecord && quickPickTemplates.length > 0 ? (
                <QuickPickTemplates
                    tenantId={tenantId}
                    templates={quickPickTemplates}
                    activeTemplateId={formDefaults?.templateId}
                />
            ) : null}

            {canRecord && accounts.length > 0 ? (
                <Card id="new-transaction-form">
                    <CardHeader>
                        <CardTitle>
                            {formDefaults
                                ? `New transaction from recurring template`
                                : 'New transaction'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            // Use the apply-template flow when a templateId
                            // is in the URL (so submission emits both
                            // TransactionRecorded AND TemplateMaterialized
                            // atomically). Otherwise the regular record
                            // action.
                            action={formAction}
                            // Keep the form's submitted URL stable so
                            // redirects + revalidations work the same
                            // either way. The hidden templateId is the
                            // only thing the apply-template path needs
                            // that the form wouldn't otherwise carry.
                            // `key` forces React to remount the form (and
                            // reset uncontrolled inputs to their new
                            // defaultValue) every time the user picks a
                            // different template.
                            key={
                                formDefaults?.templateId ?? 'manual'
                            }
                            className="grid gap-3 sm:grid-cols-2"
                        >
                            {formDefaults ? (
                                <input
                                    type="hidden"
                                    name="templateId"
                                    value={formDefaults.templateId}
                                />
                            ) : null}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="accountId">Account</Label>
                                <select
                                    id="accountId"
                                    name="accountId"
                                    required
                                    defaultValue={
                                        formDefaults?.accountId ?? ''
                                    }
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
                                    defaultValue={
                                        formDefaults?.categoryId ?? ''
                                    }
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
                                    defaultValue={
                                        formDefaults?.transactionType ??
                                        'expense'
                                    }
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
                                    defaultValue={formDefaults?.amount}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="occurredOn">Date</Label>
                                <Input
                                    id="occurredOn"
                                    name="occurredOn"
                                    type="date"
                                    defaultValue={formDefaults?.occurredOn}
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
                                    defaultValue={formDefaults?.description}
                                />
                            </div>
                            <div className="flex items-center gap-3 sm:col-span-2">
                                <Button type="submit">
                                    {formDefaults
                                        ? `Record & mark template applied`
                                        : 'Record'}
                                </Button>
                                {formDefaults ? (
                                    <Link
                                        href={`/tenants/${tenantId}/transactions#new-transaction-form`}
                                        className="text-sm text-muted-foreground hover:underline"
                                    >
                                        Clear template
                                    </Link>
                                ) : null}
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
