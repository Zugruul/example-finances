import Link from 'next/link';
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
    tenantId: string;
    templates: QuickPickTemplate[];
    /** Currently-selected template id (matches the templateId in the URL). */
    activeTemplateId?: string;
}

/**
 * Server component. Clicking a card navigates to
 * `/tenants/[id]/transactions?templateId=<id>` which causes the
 * page to pre-fill the New transaction form with this template's
 * defaults. Submitting the form actually records the transaction and
 * advances the template cursor.
 */
export function QuickPickTemplates({
    tenantId,
    templates,
    activeTemplateId,
}: Props) {
    if (templates.length === 0) return null;

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
                    const isActive = activeTemplateId === t.templateId;
                    const href = isActive
                        ? `/tenants/${tenantId}/transactions#new-transaction-form`
                        : `/tenants/${tenantId}/transactions?templateId=${encodeURIComponent(t.templateId)}#new-transaction-form`;
                    return (
                        <Link
                            key={t.templateId}
                            href={href}
                            scroll
                            className={
                                'flex flex-col gap-1 rounded-md border p-3 text-left transition hover:bg-accent/40 ' +
                                (isActive
                                    ? 'border-primary ring-2 ring-primary/30 '
                                    : '') +
                                (!isActive && t.isDueNow
                                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                                    : '')
                            }
                            title={
                                t.nextDueOn
                                    ? `Pre-fill the form for ${t.nextDueOn}`
                                    : 'Pre-fill the form for today'
                            }
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-snug">
                                    {t.title}
                                </p>
                                {isActive ? (
                                    <Badge
                                        variant="outline"
                                        className="border-primary text-[10px] text-primary"
                                    >
                                        selected
                                    </Badge>
                                ) : t.isDueNow ? (
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
                        </Link>
                    );
                })}
            </CardContent>
        </Card>
    );
}
