import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    archiveTemplateAction,
    createTemplateAction,
    materializeDueTemplatesAction,
} from '@/server/recurring';
import { nextDueOn } from '@/domains/recurring-templates';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/submit-button';
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
import { RotateCwIcon } from 'lucide-react';
import { RecurringCreateForm } from './recurring-create-form';
import { formatMoney } from '@/lib/money';

type Params = { tenantId: string };
type SearchParams = { view?: string };

function describeCadence(c: {
    kind: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    month?: number;
}): string {
    switch (c.kind) {
        case 'daily':
            return 'Daily';
        case 'weekly':
            return `Weekly · day ${c.dayOfWeek}`;
        case 'biweekly':
            return `Every 2 weeks · day ${c.dayOfWeek}`;
        case 'monthly':
            return `Monthly · day ${c.dayOfMonth}`;
        case 'yearly':
            return `Yearly · ${c.month}/${c.dayOfMonth}`;
        default:
            return c.kind;
    }
}

export default async function RecurringPage(props: {
    params: Promise<Params>;
    searchParams: Promise<SearchParams>;
}) {
    const { tenantId } = await props.params;
    const sp = await props.searchParams;
    const showArchived = sp.view === 'archived';
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const allTemplates = await readModels.recurringTemplates.find({ tenantId });
    const templates = allTemplates.filter((t) =>
        showArchived ? t.isArchived : !t.isArchived,
    );
    const counts = {
        active: allTemplates.filter((t) => !t.isArchived).length,
        archived: allTemplates.filter((t) => t.isArchived).length,
    };
    const accounts = await readModels.accountsByTenant.find({ tenantId });
    const categories = await readModels.categoriesByTenant.find({ tenantId });
    const accountById = new Map(accounts.map((a) => [String(a.accountId), a]));
    const categoryById = new Map(
        categories.map((c) => [String(c.categoryId), c]),
    );

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canManage = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin',
    );
    const canMaterialize = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin' || m.role === 'member',
    );

    const create = createTemplateAction.bind(null, tenantId);
    const materialize = materializeDueTemplatesAction.bind(null, tenantId);

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Recurring' },
                ]}
            />
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Recurring
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
                {canMaterialize ? (
                    <form action={materialize}>
                        <SubmitButton
                            variant="outline"
                            pendingLabel="Materializing…"
                        >
                            Materialize due
                        </SubmitButton>
                    </form>
                ) : null}
            </header>

            <FilterTabs
                tabs={[
                    {
                        label: 'Active',
                        href: `/tenants/${tenantId}/recurring`,
                        active: !showArchived,
                        count: counts.active,
                    },
                    {
                        label: 'Archived',
                        href: `/tenants/${tenantId}/recurring?view=archived`,
                        active: showArchived,
                        count: counts.archived,
                    },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle>
                        {showArchived ? 'Archived templates' : 'Active templates'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {templates.length === 0 ? (
                        <EmptyState
                            icon={<RotateCwIcon />}
                            title={
                                showArchived
                                    ? 'No archived templates'
                                    : 'No recurring templates yet'
                            }
                            description={
                                showArchived
                                    ? 'Archived templates will appear here when you archive an active one.'
                                    : canManage
                                      ? 'Create one with the form below.'
                                      : 'Ask an owner or admin to set up recurring templates.'
                            }
                        />
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-muted-foreground">
                                <tr className="border-b">
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
                                        Cadence
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Next due
                                    </th>
                                    <th className="px-2 py-2 text-right">
                                        Amount
                                    </th>
                                    <th className="px-2 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map((t) => {
                                    const acc = accountById.get(
                                        String(t.accountId),
                                    );
                                    const cat = t.categoryId
                                        ? categoryById.get(
                                              String(t.categoryId),
                                          )
                                        : null;
                                    const next = nextDueOn(
                                        t.cadence,
                                        t.startsOn,
                                        t.lastMaterializedOn,
                                        t.endsOn,
                                    );
                                    const archive = archiveTemplateAction.bind(
                                        null,
                                        tenantId,
                                        String(t.templateId),
                                    );
                                    return (
                                        <tr
                                            key={String(t.templateId)}
                                            id={`tpl-${t.templateId}`}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="px-2 py-2">
                                                {t.description ?? '—'}
                                            </td>
                                            <td className="px-2 py-2">
                                                {acc?.name ?? '?'}
                                            </td>
                                            <td className="px-2 py-2">
                                                {cat?.name ?? '—'}
                                            </td>
                                            <td className="px-2 py-2 font-mono text-xs">
                                                {describeCadence(t.cadence)}
                                            </td>
                                            <td className="px-2 py-2 font-mono text-xs">
                                                {next ?? '—'}
                                            </td>
                                            <td className="px-2 py-2 text-right font-mono tabular-nums">
                                                <Badge
                                                    variant="outline"
                                                    className="mr-2"
                                                >
                                                    {t.transactionType}
                                                </Badge>
                                                {acc
                                                    ? formatMoney(
                                                          t.amount,
                                                          acc.currency,
                                                      )
                                                    : t.amount}
                                            </td>
                                            <td className="px-2 py-2 text-right">
                                                {canManage ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Link
                                                            href={`/tenants/${tenantId}/recurring/${t.templateId}/edit`}
                                                        >
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                            >
                                                                Edit
                                                            </Button>
                                                        </Link>
                                                        <form action={archive}>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                type="submit"
                                                            >
                                                                Archive
                                                            </Button>
                                                        </form>
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {canManage && accounts.filter((a) => !a.isClosed).length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>New template</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RecurringCreateForm
                            action={create}
                            accounts={accounts
                                .filter((a) => !a.isClosed)
                                .map((a) => ({
                                    accountId: String(a.accountId),
                                    name: a.name,
                                    currency: a.currency,
                                }))}
                            categories={categories
                                .filter((c) => !c.isArchived)
                                .map((c) => ({
                                    categoryId: String(c.categoryId),
                                    name: c.name,
                                }))}
                        />
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
