'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import {
    OptimisticCreateForm,
    makeGhostId,
} from '@/components/optimistic-create-form';
import { parseAmountToMinor, formatMoney } from '@/lib/money';

type AccountOption = {
    accountId: string;
    name: string;
    currency: string;
};
type CategoryOption = { categoryId: string; name: string };

type TemplateGhost = {
    id: string;
    description: string;
    amount: number;
    currency: string;
    accountName: string;
    transactionType: string;
    cadenceKind: string;
};

export function RecurringCreateForm({
    action,
    accounts,
    categories,
}: {
    action: (formData: FormData) => Promise<void> | void;
    accounts: AccountOption[];
    categories: CategoryOption[];
}) {
    const accountById = Object.fromEntries(
        accounts.map((a) => [a.accountId, a] as const),
    );
    return (
        <OptimisticCreateForm<TemplateGhost>
            action={action}
            buildGhost={(fd) => {
                const accountId = String(fd.get('accountId') ?? '').trim();
                const account = accountById[accountId];
                if (!account) return null;
                const amount = parseAmountToMinor(
                    String(fd.get('amount') ?? ''),
                    account.currency,
                );
                if (amount === null || amount === 0) return null;
                const transactionType = String(
                    fd.get('transactionType') ?? '',
                ).trim();
                if (
                    transactionType !== 'income' &&
                    transactionType !== 'expense'
                ) {
                    return null;
                }
                const cadenceKind = String(
                    fd.get('cadence-kind') ?? 'monthly',
                );
                const description =
                    String(fd.get('description') ?? '').trim() ||
                    transactionType;
                return {
                    id: makeGhostId('tpl'),
                    description,
                    amount,
                    currency: account.currency,
                    accountName: account.name,
                    transactionType,
                    cadenceKind,
                };
            }}
            renderGhosts={(ghosts) => (
                <ul className="mb-3 flex flex-col gap-2">
                    {ghosts.map((g) => (
                        <li
                            key={g.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-sky-50/60 p-3 dark:bg-sky-900/20"
                        >
                            <div className="flex min-w-0 flex-col">
                                <span className="font-medium">
                                    {g.description}
                                </span>
                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-mono tabular-nums">
                                        {formatMoney(g.amount, g.currency)}
                                    </span>
                                    <Badge variant="outline">
                                        {g.transactionType}
                                    </Badge>
                                    <span>{g.cadenceKind}</span>
                                    <span>· {g.accountName}</span>
                                </span>
                            </div>
                            <Badge
                                variant="outline"
                                className="text-[10px] border-sky-500/60 text-sky-700 dark:text-sky-300"
                            >
                                creating…
                            </Badge>
                        </li>
                    ))}
                </ul>
            )}
            formProps={{ className: 'grid gap-3 sm:grid-cols-2' }}
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="accountId">Account</Label>
                <select
                    id="accountId"
                    name="accountId"
                    required
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    {accounts.map((a) => (
                        <option key={a.accountId} value={a.accountId}>
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
                    {categories.map((c) => (
                        <option key={c.categoryId} value={c.categoryId}>
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
                    placeholder="100.00"
                    required
                />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Rent" />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cadence-kind">Cadence</Label>
                <select
                    id="cadence-kind"
                    name="cadence-kind"
                    defaultValue="monthly"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="biweekly">every 2 weeks</option>
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
                    defaultValue={1}
                />
                <Input
                    name="cadence-dayOfWeek"
                    type="hidden"
                    defaultValue={1}
                />
                <Input
                    name="cadence-month"
                    type="hidden"
                    defaultValue={1}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="startsOn">Starts on</Label>
                <Input
                    id="startsOn"
                    name="startsOn"
                    type="date"
                    required
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="endsOn">Ends on (optional)</Label>
                <Input id="endsOn" name="endsOn" type="date" />
            </div>
            <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Creating…">
                    Create template
                </SubmitButton>
            </div>
        </OptimisticCreateForm>
    );
}
