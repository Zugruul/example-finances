import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    archiveBudgetAction,
    createBudgetAction,
    updateBudgetAction,
} from '@/server/budgets';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/submit-button';
import { BudgetsCreateForm } from './budgets-create-form';
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
import { TargetIcon } from 'lucide-react';
import { formatMoney, minorUnitsToMajor } from '@/lib/money';

type Params = { tenantId: string };

export default async function BudgetsPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId } = await props.params;
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const docs = (
        await readModels.budgetsByTenant.find({ tenantId })
    ).filter((b) => !b.isArchived);
    const categories = await readModels.categoriesByTenant.find({ tenantId });
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

    const create = createBudgetAction.bind(null, tenantId);

    // Categories that don't yet have an active budget.
    const usedCategoryIds = new Set(docs.map((b) => String(b.categoryId)));
    const eligibleCategories = categories.filter(
        (c) =>
            !c.isArchived &&
            !usedCategoryIds.has(String(c.categoryId)) &&
            c.categoryType !== 'transfer',
    );

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Budgets' },
                ]}
            />
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Budgets
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

            <Card>
                <CardHeader>
                    <CardTitle>Active budgets</CardTitle>
                </CardHeader>
                <CardContent>
                    {docs.length === 0 ? (
                        <EmptyState
                            icon={<TargetIcon />}
                            title="No budgets yet"
                            description={
                                canManage
                                    ? 'Create one with the form below.'
                                    : 'Ask an owner or admin to set up budgets.'
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {docs.map((b) => {
                                const cat = categoryById.get(
                                    String(b.categoryId),
                                );
                                const effective =
                                    b.monthlyAmount +
                                    b.currentMonth.rolloverBalance;
                                const remaining = Math.max(
                                    0,
                                    effective - b.currentMonth.spent,
                                );
                                const overspent =
                                    b.currentMonth.spent > effective;
                                const pct =
                                    effective === 0
                                        ? 0
                                        : Math.min(
                                              100,
                                              (b.currentMonth.spent /
                                                  effective) *
                                                  100,
                                          );
                                const update = updateBudgetAction.bind(
                                    null,
                                    tenantId,
                                    String(b.budgetId),
                                );
                                const archive = archiveBudgetAction.bind(
                                    null,
                                    tenantId,
                                    String(b.budgetId),
                                );
                                return (
                                    <li
                                        key={String(b.budgetId)}
                                        className="rounded-md border p-4"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {cat?.name ?? 'Unknown category'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {b.currentMonth.year}-
                                                    {String(
                                                        b.currentMonth.month,
                                                    ).padStart(2, '0')}{' '}
                                                    · {b.rolloverPolicy}{' '}
                                                    {b.currentMonth.rolloverBalance >
                                                    0
                                                        ? `· +${formatMoney(
                                                              b.currentMonth.rolloverBalance,
                                                              b.currency,
                                                          )} rollover`
                                                        : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right text-sm">
                                                    <div className="font-mono tabular-nums">
                                                        {formatMoney(
                                                            b.currentMonth.spent,
                                                            b.currency,
                                                        )}{' '}
                                                        /{' '}
                                                        {formatMoney(
                                                            effective,
                                                            b.currency,
                                                        )}
                                                    </div>
                                                    {overspent ? (
                                                        <Badge variant="destructive">
                                                            overspent
                                                        </Badge>
                                                    ) : (
                                                        <div className="text-xs text-muted-foreground">
                                                            {formatMoney(
                                                                remaining,
                                                                b.currency,
                                                            )}{' '}
                                                            left
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={
                                                    overspent
                                                        ? 'h-2 bg-destructive'
                                                        : 'h-2 bg-primary'
                                                }
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        {canManage ? (
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <form
                                                    action={update}
                                                    className="flex flex-wrap items-end gap-2"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <Label
                                                            htmlFor={`amt-${b.budgetId}`}
                                                            className="text-xs"
                                                        >
                                                            Monthly
                                                        </Label>
                                                        <Input
                                                            id={`amt-${b.budgetId}`}
                                                            name="monthlyAmount"
                                                            type="text"
                                                            inputMode="decimal"
                                                            defaultValue={minorUnitsToMajor(
                                                                b.monthlyAmount,
                                                                b.currency,
                                                            ).toFixed(2)}
                                                            className="h-8 w-28"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <Label
                                                            htmlFor={`policy-${b.budgetId}`}
                                                            className="text-xs"
                                                        >
                                                            Policy
                                                        </Label>
                                                        <select
                                                            id={`policy-${b.budgetId}`}
                                                            name="rolloverPolicy"
                                                            defaultValue={
                                                                b.rolloverPolicy
                                                            }
                                                            className="h-8 rounded-md border bg-background px-2 text-sm"
                                                        >
                                                            <option value="none">
                                                                none
                                                            </option>
                                                            <option value="carry-forward">
                                                                carry-forward
                                                            </option>
                                                            <option value="reset">
                                                                reset
                                                            </option>
                                                        </select>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        type="submit"
                                                    >
                                                        Save
                                                    </Button>
                                                </form>
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
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage && eligibleCategories.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>New budget</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <BudgetsCreateForm
                            action={create}
                            eligibleCategories={eligibleCategories.map((c) => ({
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
