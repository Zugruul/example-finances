'use client';

import { useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClockIcon } from 'lucide-react';
import { formatMoney } from '@/lib/money';

export type QuickPickTemplate = {
    templateId: string;
    title: string;
    transactionType: 'income' | 'expense';
    amount: number;
    currency: string;
    accountName: string;
    /** Next on-cadence due date (yyyy-mm-dd) or null if no further occurrences. */
    nextDueOn: string | null;
    /** True when nextDueOn ≤ today (i.e., overdue or due now). */
    isDueNow: boolean;
    cadenceLabel: string;
};

interface Props {
    templates: QuickPickTemplate[];
    /** Server action bound with tenantId; FormData = {templateId, occurredOn?}. */
    applyAction: (formData: FormData) => Promise<void> | void;
}

export function QuickPickTemplates({ templates, applyAction }: Props) {
    const [isPending, startTransition] = useTransition();

    if (templates.length === 0) return null;

    function apply(t: QuickPickTemplate) {
        const fd = new FormData();
        fd.set('templateId', t.templateId);
        if (t.nextDueOn) fd.set('occurredOn', t.nextDueOn);
        startTransition(async () => {
            try {
                await applyAction(fd);
            } catch (err) {
                console.error('[quick-pick] apply failed', err);
            }
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarClockIcon className="size-4" />
                    Recurring templates
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => {
                    const sign = t.transactionType === 'income' ? '+' : '−';
                    return (
                        <button
                            key={t.templateId}
                            type="button"
                            disabled={isPending}
                            onClick={() => apply(t)}
                            className={
                                'flex flex-col gap-1 rounded-md border p-3 text-left transition hover:bg-accent/40 disabled:cursor-wait disabled:opacity-60 ' +
                                (t.isDueNow
                                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                                    : '')
                            }
                            title={
                                t.nextDueOn
                                    ? `Apply for ${t.nextDueOn}`
                                    : 'Apply for today'
                            }
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-snug">
                                    {t.title}
                                </p>
                                {t.isDueNow ? (
                                    <Badge
                                        variant="outline"
                                        className="border-emerald-500 text-[10px] text-emerald-700 dark:text-emerald-300"
                                    >
                                        due
                                    </Badge>
                                ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t.accountName} · {t.cadenceLabel}
                            </p>
                            <div className="flex items-baseline justify-between gap-2 pt-1">
                                <span className="font-mono tabular-nums text-sm">
                                    {sign}
                                    {formatMoney(t.amount, t.currency)}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    {t.nextDueOn ?? 'no upcoming date'}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </CardContent>
        </Card>
    );
}
