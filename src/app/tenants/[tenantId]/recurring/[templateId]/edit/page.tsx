import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { updateTemplateAction } from '@/server/recurring';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import type { Cadence } from '@/domains/recurring-templates';

type Params = { tenantId: string; templateId: string };

function dayOfWeekField(c: Cadence): number {
    if (c.kind === 'weekly' || c.kind === 'biweekly') return c.dayOfWeek;
    return 1;
}

function dayOfMonthField(c: Cadence): number {
    if (c.kind === 'monthly') return c.dayOfMonth;
    if (c.kind === 'yearly') return c.dayOfMonth;
    return 1;
}

function monthField(c: Cadence): number {
    if (c.kind === 'yearly') return c.month;
    return 1;
}

export default async function EditTemplatePage(props: {
    params: Promise<Params>;
}) {
    const { tenantId, templateId } = await props.params;
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const memberships = (
        await readModels.memberships.find({
            tenantId,
            userId: session.user.id,
        })
    ).filter((m) => !m.removedAt);
    const role = memberships[0]?.role;
    if (!role || (role !== 'owner' && role !== 'admin' && role !== 'member')) {
        throw new Error('Forbidden — insufficient role for this tenant.');
    }

    const [tpl] = await readModels.recurringTemplates.find({
        templateId,
    });
    if (!tpl || String(tpl.tenantId) !== tenantId) notFound();
    if (tpl.isArchived) {
        throw new Error('Cannot edit an archived template.');
    }

    const accounts = await readModels.accountsByTenant.find({ tenantId });
    const categories = await readModels.categoriesByTenant.find({ tenantId });
    const accountCurrentlyOn = accounts.find(
        (a) => String(a.accountId) === String(tpl.accountId),
    );
    const categoryCurrentlyOn = tpl.categoryId
        ? categories.find(
              (c) => String(c.categoryId) === String(tpl.categoryId),
          )
        : null;

    const update = updateTemplateAction.bind(null, tenantId, templateId);
    const cadence = tpl.cadence as Cadence;
    const majorAmount = (tpl.amount / 100).toFixed(2);

    return (
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Workspaces', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    {
                        label: 'Recurring',
                        href: `/tenants/${tenantId}/recurring`,
                    },
                    { label: tpl.description ?? 'Template' },
                ]}
            />

            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Edit recurring template
                </h1>
                <p className="text-sm text-muted-foreground">
                    Cadence, Account, Amount and Description are mutable.
                    Type and Category are locked for the template's life —
                    they're baked into every historical materialization
                    pointing at it.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        action={update}
                        className="grid gap-3 sm:grid-cols-2"
                    >
                        {/* Type — locked */}
                        <div className="flex flex-col gap-1.5">
                            <Label>
                                Type
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                    (locked)
                                </span>
                            </Label>
                            <div className="h-9 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                                {tpl.transactionType}
                            </div>
                        </div>

                        {/* Category — locked */}
                        <div className="flex flex-col gap-1.5">
                            <Label>
                                Category
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                    (locked)
                                </span>
                            </Label>
                            <div className="h-9 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                                {categoryCurrentlyOn?.name ?? '(none)'}
                            </div>
                        </div>

                        {/* Account — editable */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="accountId">Account</Label>
                            <select
                                id="accountId"
                                name="accountId"
                                required
                                defaultValue={String(tpl.accountId)}
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

                        {/* Amount — editable */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="amount">
                                Amount
                                {accountCurrentlyOn ? (
                                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                        ({accountCurrentlyOn.currency})
                                    </span>
                                ) : null}
                            </Label>
                            <Input
                                id="amount"
                                name="amount"
                                type="text"
                                inputMode="decimal"
                                defaultValue={majorAmount}
                                required
                            />
                        </div>

                        {/* Description — editable */}
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                name="description"
                                defaultValue={tpl.description ?? ''}
                            />
                        </div>

                        {/* Cadence — editable */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="cadence-kind">Cadence</Label>
                            <select
                                id="cadence-kind"
                                name="cadence-kind"
                                defaultValue={cadence.kind}
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                            >
                                <option value="daily">daily</option>
                                <option value="weekly">weekly</option>
                                <option value="biweekly">
                                    every 2 weeks
                                </option>
                                <option value="monthly">monthly</option>
                                <option value="yearly">yearly</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="cadence-dayOfMonth">
                                Day-of-month / -week
                            </Label>
                            <Input
                                id="cadence-dayOfMonth"
                                name="cadence-dayOfMonth"
                                type="number"
                                min={1}
                                max={31}
                                defaultValue={dayOfMonthField(cadence)}
                            />
                            <Input
                                name="cadence-dayOfWeek"
                                type="hidden"
                                defaultValue={dayOfWeekField(cadence)}
                            />
                            <Input
                                name="cadence-month"
                                type="hidden"
                                defaultValue={monthField(cadence)}
                            />
                        </div>

                        <div className="flex items-center gap-3 sm:col-span-2">
                            <Button type="submit">Save</Button>
                            <Link
                                href={`/tenants/${tenantId}/recurring`}
                                className="text-sm text-muted-foreground hover:underline"
                            >
                                Cancel
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
