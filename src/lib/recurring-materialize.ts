import 'server-only';
import { v7 as uuidv7 } from 'uuid';
import { aggregates, readModels } from '@/sorc';
import { dueDatesUpTo } from '@/domains/recurring-templates';
import type { TransactionStreamInstance } from '@/domains/transactions';
import type { TemplateStreamInstance } from '@/domains/recurring-templates';
import type { SorcUUID } from '@event-sorcerer/core';

/**
 * Side-effect-only materialization, callable from page renders (e.g.
 * `/dashboard`). Best-effort: swallows per-template errors and returns
 * the count of transactions emitted.
 *
 * This is a plain async function (NOT a server action) so it can be
 * invoked during a page's server-side render without triggering a
 * redirect. For the button-triggered + toast-redirect flow, see
 * `materializeDueTemplatesAction` in `src/server/recurring.ts`.
 */
export async function materializeDueTemplates(
    tenantId: string,
    userId: SorcUUID,
): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const templates = (
        await readModels.recurringTemplates.find({ tenantId })
    ).filter((t) => !t.isArchived);

    let emitted = 0;
    for (const t of templates) {
        const due = dueDatesUpTo(
            t.cadence,
            t.startsOn,
            t.lastMaterializedOn,
            t.endsOn,
            today,
        );
        for (const occurredOn of due) {
            const [account] = await readModels.accountsByTenant.find({
                accountId: t.accountId,
            });
            if (!account || account.isClosed) break;
            const transactionId = uuidv7() as SorcUUID;
            const txStream = `transaction-${transactionId}` as TransactionStreamInstance;
            try {
                await aggregates.transaction.execute(
                    'recordTransaction',
                    {
                        transactionId,
                        tenantId: tenantId as SorcUUID,
                        accountId: t.accountId,
                        categoryId: t.categoryId,
                        amount: t.amount,
                        currency: account.currency,
                        occurredOn,
                        description: t.description,
                        transactionType: t.transactionType,
                        templateId: t.templateId,
                        recordedByUserId: userId,
                        stream: txStream,
                    } as never,
                    { store: 'mongostore' as never, stream: txStream },
                );
                const tplStream =
                    `template-${String(t.templateId)}` as TemplateStreamInstance;
                await aggregates.recurringTemplate.execute(
                    'materializeTemplate',
                    {
                        materializedOn: occurredOn,
                        transactionId,
                        stream: tplStream,
                    } as never,
                    { store: 'mongostore' as never, stream: tplStream },
                );
                emitted++;
            } catch (err) {
                console.error(
                    '[recurring] materialize failed (dashboard side-effect)',
                    {
                        templateId: String(t.templateId),
                        occurredOn,
                        err,
                    },
                );
                break;
            }
        }
    }
    return emitted;
}
