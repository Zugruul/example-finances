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

type CategoryOption = { categoryId: string; name: string };
type BudgetGhost = {
    id: string;
    categoryName: string;
    monthlyAmount: number;
    currency: string;
    rolloverPolicy: string;
};

export function BudgetsCreateForm({
    action,
    eligibleCategories,
}: {
    action: (formData: FormData) => Promise<void> | void;
    eligibleCategories: CategoryOption[];
}) {
    const categoryNameById = Object.fromEntries(
        eligibleCategories.map((c) => [c.categoryId, c.name]),
    );
    return (
        <OptimisticCreateForm<BudgetGhost>
            action={action}
            buildGhost={(fd) => {
                const categoryId = String(fd.get('categoryId') ?? '').trim();
                const categoryName = categoryNameById[categoryId];
                if (!categoryName) return null;
                const currency = String(fd.get('currency') ?? '')
                    .trim()
                    .toUpperCase();
                if (!/^[A-Z]{3}$/.test(currency)) return null;
                const monthly = parseAmountToMinor(
                    String(fd.get('monthlyAmount') ?? ''),
                    currency,
                );
                if (monthly === null) return null;
                return {
                    id: makeGhostId('bud'),
                    categoryName,
                    monthlyAmount: monthly,
                    currency,
                    rolloverPolicy: String(
                        fd.get('rolloverPolicy') ?? 'none',
                    ),
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
                                    {g.categoryName}
                                </span>
                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-mono tabular-nums">
                                        {formatMoney(
                                            g.monthlyAmount,
                                            g.currency,
                                        )}
                                    </span>
                                    <Badge variant="outline">
                                        {g.rolloverPolicy}
                                    </Badge>
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
                <Label htmlFor="categoryId">Category</Label>
                <select
                    id="categoryId"
                    name="categoryId"
                    required
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    {eligibleCategories.map((c) => (
                        <option key={c.categoryId} value={c.categoryId}>
                            {c.name}
                        </option>
                    ))}
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
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="monthlyAmount">Monthly amount</Label>
                <Input
                    id="monthlyAmount"
                    name="monthlyAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder="500.00"
                    required
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="rolloverPolicy">Rollover</Label>
                <select
                    id="rolloverPolicy"
                    name="rolloverPolicy"
                    defaultValue="none"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    <option value="none">none</option>
                    <option value="carry-forward">carry-forward</option>
                    <option value="reset">reset</option>
                </select>
            </div>
            <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Creating…">
                    Create budget
                </SubmitButton>
            </div>
        </OptimisticCreateForm>
    );
}
