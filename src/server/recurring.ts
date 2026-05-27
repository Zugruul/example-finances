'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels, sorc } from '@/sorc';
import {
    dueDatesUpTo,
    nextDueOn,
    TemplateMaterializedEvent,
    type TemplateStreamInstance,
    type TemplateType,
    type Cadence,
} from '@/domains/recurring-templates';
import {
    TransactionRecordedEvent,
    type TransactionStreamInstance,
} from '@/domains/transactions';
import type { MembershipRole } from '@/domains/tenants';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext } from '@/lib/actor-context';
import { parseAmountToMinor } from '@/lib/money';

const TX_TYPES: readonly TemplateType[] = ['income', 'expense'];

async function requireSession() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');
    return session;
}

async function requireRole(
    tenantId: string,
    userId: string,
    allowed: readonly MembershipRole[],
) {
    const memberships = await readModels.memberships.find({ tenantId, userId });
    const active = memberships.find((m) => !m.removedAt);
    if (!active || !allowed.includes(active.role)) {
        throw new Error('Forbidden — insufficient role for this tenant.');
    }
    return active;
}

function templateStream(templateId: string): TemplateStreamInstance {
    return `template-${templateId}` as TemplateStreamInstance;
}

function transactionStream(transactionId: string): TransactionStreamInstance {
    return `transaction-${transactionId}` as TransactionStreamInstance;
}

function todayYmd(): string {
    return new Date().toISOString().slice(0, 10);
}

function parseYmdStrict(raw: string, label: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw new Error(`Invalid ${label} "${raw}" (expected YYYY-MM-DD)`);
    }
    return raw;
}

function parseCadence(formData: FormData): Cadence {
    const kind = String(formData.get('cadence-kind') ?? '').trim();
    switch (kind) {
        case 'daily':
            return { kind: 'daily' };
        case 'weekly': {
            const dow = Number(formData.get('cadence-dayOfWeek') ?? '');
            if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
                throw new Error('Invalid day of week (0-6).');
            }
            return { kind: 'weekly', dayOfWeek: dow };
        }
        case 'monthly': {
            const dom = Number(formData.get('cadence-dayOfMonth') ?? '');
            if (!Number.isInteger(dom) || dom < 1 || dom > 31) {
                throw new Error('Invalid day of month (1-31).');
            }
            return { kind: 'monthly', dayOfMonth: dom };
        }
        case 'yearly': {
            const m = Number(formData.get('cadence-month') ?? '');
            const dom = Number(formData.get('cadence-dayOfMonth') ?? '');
            if (!Number.isInteger(m) || m < 1 || m > 12) {
                throw new Error('Invalid month (1-12).');
            }
            if (!Number.isInteger(dom) || dom < 1 || dom > 31) {
                throw new Error('Invalid day of month (1-31).');
            }
            return { kind: 'yearly', month: m, dayOfMonth: dom };
        }
        default:
            throw new Error(`Invalid cadence kind "${kind}"`);
    }
}

export const createTemplateAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const accountId = String(formData.get('accountId') ?? '').trim();
        if (!accountId) throw new Error('Account is required.');
        const [account] = await readModels.accountsByTenant.find({ accountId });
        if (!account || String(account.tenantId) !== tenantId) {
            throw new Error('Account not found in this tenant.');
        }

        const transactionType = String(
            formData.get('transactionType') ?? '',
        ) as TemplateType;
        if (!TX_TYPES.includes(transactionType)) {
            throw new Error('Invalid transaction type.');
        }
        const amount = parseAmountToMinor(
            String(formData.get('amount') ?? ''),
            account.currency,
        );
        if (amount === null || amount === 0) {
            throw new Error('Amount must be a positive decimal.');
        }

        const description =
            String(formData.get('description') ?? '').trim() || undefined;
        const categoryRaw = String(formData.get('categoryId') ?? '').trim();
        const categoryId = categoryRaw ? (categoryRaw as SorcUUID) : undefined;
        const startsOn = parseYmdStrict(
            String(formData.get('startsOn') ?? ''),
            'startsOn',
        );
        const endsOnRaw = String(formData.get('endsOn') ?? '').trim();
        const endsOn = endsOnRaw
            ? parseYmdStrict(endsOnRaw, 'endsOn')
            : undefined;
        const cadence = parseCadence(formData);

        const templateId = uuidv7() as SorcUUID;
        const stream = templateStream(templateId);

        await aggregates.recurringTemplate.execute(
            'createTemplate',
            {
                templateId,
                tenantId: tenantId as SorcUUID,
                accountId: accountId as SorcUUID,
                categoryId,
                amount,
                description,
                transactionType,
                cadence,
                startsOn,
                endsOn,
                createdByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/recurring`);
        redirect(
            withToast(
                `/tenants/${tenantId}/recurring`,
                'success',
                'Template created',
            ),
        );
    },
);

export const archiveTemplateAction = withActorContext(
    async (tenantId: string, templateId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);
        const stream = templateStream(templateId);
        await aggregates.recurringTemplate.execute(
            'archiveTemplate',
            { archivedByUserId: userId, stream } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/recurring`);
        redirect(
            withToast(
                `/tenants/${tenantId}/recurring`,
                'success',
                'Template archived',
            ),
        );
    },
);

/**
 * Materialize any due-or-past-due templates for the current tenant. Idempotent
 * via the aggregate's `lastMaterializedOn` guard. Catches up multiple periods
 * if missed (e.g. monthly template last fired Jan 1, today is Mar 5 →
 * emits two transactions: Feb 1 and Mar 1).
 *
 * Emits TransactionRecorded first, then TemplateMaterialized. The materialize
 * event records the just-emitted transactionId; if the second emit fails after
 * the first succeeded, the transaction is recorded as expected but the
 * template's `lastMaterializedOn` doesn't advance — the next run will detect
 * a duplicate due date and **re-emit**. Acceptable risk for MVP; documented
 * as a known limitation in [[domains-recurring]].
 */
export const materializeDueTemplatesAction = withActorContext(
    async (tenantId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        // Any tenant member can trigger materialization.
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const today = todayYmd();
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
                if (!account || account.isClosed) {
                    // Skip — account gone or closed.
                    break;
                }
                const transactionId = uuidv7() as SorcUUID;
                const txStream = transactionStream(transactionId);
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

                    const tplStream = templateStream(String(t.templateId));
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
                    console.error('[recurring] materialize failed', {
                        templateId: String(t.templateId),
                        occurredOn,
                        err,
                    });
                    break; // stop catch-up for this template on first error
                }
            }
        }

        revalidatePath(`/tenants/${tenantId}/recurring`);
        revalidatePath(`/tenants/${tenantId}/transactions`);
        revalidatePath(`/dashboard`);
        redirect(
            withToast(
                `/tenants/${tenantId}/recurring`,
                emitted > 0 ? 'success' : 'info',
                emitted > 0
                    ? `Materialized ${emitted} transaction(s)`
                    : 'Nothing due',
            ),
        );
    },
);

/**
 * Apply ONE recurring template for a single occurrence — used by the
 * quick-pick cards on /tenants/[id]/transactions. Emits both a fresh
 * `TransactionRecorded` AND a `TemplateMaterialized` for the same
 * `occurredOn` inside a single Mongo transaction (sorc.publishAtomic),
 * so the template's `lastMaterializedOn` cursor advances or neither
 * event lands.
 *
 * If `occurredOn` is omitted, uses the template's next due date (or
 * today if no on-cadence date is available).
 */
export const applyTemplateAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const templateId = String(formData.get('templateId') ?? '').trim();
        if (!templateId) throw new Error('templateId is required.');
        const occurredOnRaw = String(
            formData.get('occurredOn') ?? '',
        ).trim();

        const [t] = await readModels.recurringTemplates.find({
            templateId: templateId as SorcUUID,
        });
        if (!t || String(t.tenantId) !== tenantId) {
            throw new Error('Template not found in this tenant.');
        }
        if (t.isArchived) throw new Error('Template is archived.');

        const [account] = await readModels.accountsByTenant.find({
            accountId: t.accountId,
        });
        if (!account || account.isClosed) {
            throw new Error('Account not available for this template.');
        }

        // Pick the date. Caller override > template's next on-cadence
        // due date > today. The aggregate enforces idempotence by
        // refusing to materialize a date at-or-before lastMaterializedOn.
        const today = todayYmd();
        const due = nextDueOn(
            t.cadence,
            t.startsOn,
            t.lastMaterializedOn,
            t.endsOn,
        );
        const occurredOn = occurredOnRaw || due || today;

        const transactionId = uuidv7() as SorcUUID;
        const txStream = transactionStream(transactionId);
        const tplStream = templateStream(String(t.templateId));

        // Atomic pair: the transaction AND the template-materialized
        // event commit together. If either CAS fails, both abort. This
        // closes the "transaction succeeded but template cursor didn't
        // advance" gap that the bulk materializeDueTemplates flow still
        // has.
        const txEvent = sorc.event({
            name: 'TransactionRecorded' as const,
            version: '2026-05-26' as const,
            stream: txStream,
            payload: {
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
                recordedAt: new Date(),
            } as InstanceType<typeof TransactionRecordedEvent>['payload'],
        } as never);
        const tplEvent = sorc.event({
            name: 'TemplateMaterialized' as const,
            version: '2026-05-26' as const,
            stream: tplStream,
            payload: {
                templateId: t.templateId,
                materializedOn: occurredOn,
                transactionId,
                materializedAt: new Date(),
            } as InstanceType<typeof TemplateMaterializedEvent>['payload'],
        } as never);

        try {
            await sorc.publishAtomic('mongostore' as never, [
                {
                    event: txEvent,
                    options: { expectedRevision: null },
                },
                { event: tplEvent },
            ]);
        } catch (err) {
            console.error('[apply-template] atomic publish failed', {
                templateId,
                occurredOn,
                err,
            });
            throw err;
        }

        revalidatePath(`/tenants/${tenantId}/transactions`);
        revalidatePath(`/tenants/${tenantId}/recurring`);
        revalidatePath(`/tenants/${tenantId}/accounts/${t.accountId}`);
        redirect(
            withToast(
                `/tenants/${tenantId}/transactions`,
                'success',
                `Recorded ${t.description ?? t.transactionType} for ${occurredOn}`,
            ),
        );
    },
);
