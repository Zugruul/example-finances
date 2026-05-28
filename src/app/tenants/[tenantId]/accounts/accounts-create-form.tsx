'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import {
    OptimisticCreateForm,
    makeGhostId,
} from '@/components/optimistic-create-form';

type AccountGhost = {
    id: string;
    name: string;
    accountType: string;
    currency: string;
};

export function AccountsCreateForm({
    action,
    defaultCurrency,
}: {
    action: (formData: FormData) => Promise<void> | void;
    defaultCurrency: string;
}) {
    return (
        <OptimisticCreateForm<AccountGhost>
            action={action}
            buildGhost={(fd) => {
                const name = String(fd.get('name') ?? '').trim();
                if (!name) return null;
                const accountType = String(
                    fd.get('accountType') ?? 'checking',
                );
                const currency = String(fd.get('currency') ?? '')
                    .trim()
                    .toUpperCase();
                if (!/^[A-Z]{3}$/.test(currency)) return null;
                return {
                    id: makeGhostId('acc'),
                    name,
                    accountType,
                    currency,
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
                                <span className="font-medium">{g.name}</span>
                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">
                                        {g.accountType}
                                    </Badge>
                                    <span>{g.currency}</span>
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
                    <option value="investment">investment</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Input
                    id="currency"
                    name="currency"
                    required
                    defaultValue={defaultCurrency}
                    maxLength={3}
                    pattern="[A-Za-z]{3}"
                    className="uppercase"
                />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="openingBalance">Opening balance</Label>
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
                <SubmitButton pendingLabel="Creating…">
                    Create account
                </SubmitButton>
            </div>
        </OptimisticCreateForm>
    );
}
