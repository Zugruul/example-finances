'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels, sorc } from '@/sorc';
import {
    TransactionRecordedEvent,
    type TransactionStreamInstance,
    type TransactionType,
} from '@/domains/transactions';
import type { MembershipRole } from '@/domains/tenants';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext } from '@/lib/actor-context';
import { parseAmountToMinor } from '@/lib/money';

const TX_TYPES: readonly TransactionType[] = ['income', 'expense'];

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
    const memberships = await readModels.memberships.find({
        tenantId,
        userId,
    });
    const active = memberships.find((m) => !m.removedAt);
    if (!active || !allowed.includes(active.role)) {
        throw new Error('Forbidden — insufficient role for this tenant.');
    }
    return active;
}

function transactionStream(transactionId: string): TransactionStreamInstance {
    return `transaction-${transactionId}` as TransactionStreamInstance;
}

function parseTxType(raw: string): TransactionType {
    if (!TX_TYPES.includes(raw as TransactionType)) {
        throw new Error(`Invalid transaction type "${raw}"`);
    }
    return raw as TransactionType;
}

function parseOccurredOn(raw: string): string {
    const trimmed = raw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        throw new Error(`Invalid date "${raw}" (expected YYYY-MM-DD)`);
    }
    const ms = Date.parse(`${trimmed}T00:00:00Z`);
    if (!Number.isFinite(ms)) {
        throw new Error(`Invalid date "${raw}"`);
    }
    return trimmed;
}

export const recordTransactionAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        // `member` and above can record transactions (operate within
        // existing structure). `viewer` is read-only.
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const accountId = String(formData.get('accountId') ?? '').trim();
        if (!accountId) throw new Error('Account is required.');
        const [account] = await readModels.accountsByTenant.find({ accountId });
        if (!account || String(account.tenantId) !== tenantId) {
            throw new Error('Account not found in this tenant.');
        }
        if (account.isClosed) {
            throw new Error('Account is closed; cannot record transactions.');
        }

        const transactionType = parseTxType(
            String(formData.get('transactionType') ?? ''),
        );
        const amountRaw = String(formData.get('amount') ?? '').trim();
        const amount = parseAmountToMinor(amountRaw, account.currency);
        if (amount === null || amount === 0) {
            throw new Error('Amount must be a positive decimal.');
        }
        const occurredOn = parseOccurredOn(
            String(formData.get('occurredOn') ?? ''),
        );
        const description =
            String(formData.get('description') ?? '').trim() || undefined;
        const categoryRaw = String(formData.get('categoryId') ?? '').trim();
        const categoryId = categoryRaw ? (categoryRaw as SorcUUID) : undefined;

        if (categoryId) {
            const [category] = await readModels.categoriesByTenant.find({
                categoryId,
            });
            if (!category || String(category.tenantId) !== tenantId) {
                throw new Error('Category not found in this tenant.');
            }
        }

        const transactionId = uuidv7() as SorcUUID;
        const stream = transactionStream(transactionId);

        await aggregates.transaction.execute(
            'recordTransaction',
            {
                transactionId,
                tenantId: tenantId as SorcUUID,
                accountId: accountId as SorcUUID,
                categoryId,
                amount,
                currency: account.currency,
                occurredOn,
                description,
                transactionType,
                recordedByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/transactions`);
        revalidatePath(`/tenants/${tenantId}/accounts/${accountId}`);
        redirect(
            withToast(
                `/tenants/${tenantId}/transactions`,
                'success',
                'Transaction recorded',
            ),
        );
    },
);

export const updateTransactionAction = withActorContext(
    async (
        tenantId: string,
        transactionId: string,
        formData: FormData,
    ) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const [tx] = await readModels.transactions.find({
            transactionId,
        });
        if (!tx || String(tx.tenantId) !== tenantId) {
            throw new Error('Transaction not found.');
        }
        if (tx.isDeleted) throw new Error('Transaction is deleted.');

        const amountRaw = String(formData.get('amount') ?? '').trim();
        const amount =
            amountRaw === ''
                ? undefined
                : (parseAmountToMinor(amountRaw, tx.currency) ?? undefined);
        if (amountRaw && amount === undefined) {
            throw new Error('Amount must be a positive decimal.');
        }
        const occurredOnRaw = String(formData.get('occurredOn') ?? '').trim();
        const occurredOn = occurredOnRaw
            ? parseOccurredOn(occurredOnRaw)
            : undefined;
        const descriptionRaw = String(formData.get('description') ?? '');
        const description = descriptionRaw.trim() || undefined;
        const categoryRaw = String(formData.get('categoryId') ?? '').trim();
        const categoryId = categoryRaw ? (categoryRaw as SorcUUID) : undefined;

        const stream = transactionStream(transactionId);
        await aggregates.transaction.execute(
            'updateTransaction',
            {
                categoryId,
                amount,
                occurredOn,
                description,
                updatedByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/transactions`);
        revalidatePath(`/tenants/${tenantId}/transactions/${transactionId}`);
        revalidatePath(`/tenants/${tenantId}/accounts/${tx.accountId}`);
        redirect(
            withToast(
                `/tenants/${tenantId}/transactions/${transactionId}`,
                'success',
                'Transaction updated',
            ),
        );
    },
);

export const recordTransferAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const fromAccountId = String(
            formData.get('fromAccountId') ?? '',
        ).trim();
        const toAccountId = String(formData.get('toAccountId') ?? '').trim();
        if (!fromAccountId || !toAccountId) {
            throw new Error('From and To accounts are required.');
        }
        if (fromAccountId === toAccountId) {
            throw new Error(
                'From and To accounts must be different — pick two accounts.',
            );
        }

        const [fromAccount] = await readModels.accountsByTenant.find({
            accountId: fromAccountId,
        });
        const [toAccount] = await readModels.accountsByTenant.find({
            accountId: toAccountId,
        });
        if (
            !fromAccount ||
            String(fromAccount.tenantId) !== tenantId ||
            !toAccount ||
            String(toAccount.tenantId) !== tenantId
        ) {
            throw new Error('Account not found in this tenant.');
        }
        if (fromAccount.isClosed || toAccount.isClosed) {
            throw new Error('Closed accounts cannot transfer.');
        }
        // MVP: same-currency only — see [[invariants]].
        if (fromAccount.currency !== toAccount.currency) {
            throw new Error(
                `Cross-currency transfers not supported (${fromAccount.currency} → ${toAccount.currency}).`,
            );
        }

        const amountRaw = String(formData.get('amount') ?? '').trim();
        const amount = parseAmountToMinor(amountRaw, fromAccount.currency);
        if (amount === null || amount === 0) {
            throw new Error('Amount must be a positive decimal.');
        }
        const occurredOn = parseOccurredOn(
            String(formData.get('occurredOn') ?? ''),
        );
        const description =
            String(formData.get('description') ?? '').trim() || undefined;

        const debitId = uuidv7() as SorcUUID;
        const creditId = uuidv7() as SorcUUID;
        const debitStream = transactionStream(debitId);
        const creditStream = transactionStream(creditId);

        // Cross-stream atomic publish: both legs commit or neither does.
        // Replaces the previous compensating-soft-delete pattern now that
        // the framework's `sorc.publishAtomic` wraps the per-leg CAS +
        // insert in a single Mongo transaction (F.framework #9).
        const debitEvent = sorc.event({
            name: 'TransactionRecorded' as const,
            version: '2026-05-26' as const,
            stream: debitStream,
            payload: {
                transactionId: debitId,
                tenantId: tenantId as SorcUUID,
                accountId: fromAccount.accountId,
                amount,
                currency: fromAccount.currency,
                occurredOn,
                description,
                transactionType: 'transfer' as const,
                counterpartTransactionId: creditId,
                transferDirection: 'debit' as const,
                recordedByUserId: userId,
                recordedAt: new Date(),
            } as InstanceType<typeof TransactionRecordedEvent>['payload'],
        } as never);
        const creditEvent = sorc.event({
            name: 'TransactionRecorded' as const,
            version: '2026-05-26' as const,
            stream: creditStream,
            payload: {
                transactionId: creditId,
                tenantId: tenantId as SorcUUID,
                accountId: toAccount.accountId,
                amount,
                currency: toAccount.currency,
                occurredOn,
                description,
                transactionType: 'transfer' as const,
                counterpartTransactionId: debitId,
                transferDirection: 'credit' as const,
                recordedByUserId: userId,
                recordedAt: new Date(),
            } as InstanceType<typeof TransactionRecordedEvent>['payload'],
        } as never);
        try {
            await sorc.publishAtomic('mongostore' as never, [
                { event: debitEvent, options: { expectedRevision: null } },
                { event: creditEvent, options: { expectedRevision: null } },
            ]);
        } catch (err) {
            console.error('[transfer] atomic publish failed', {
                debitId,
                creditId,
                err,
            });
            throw err;
        }

        revalidatePath(`/tenants/${tenantId}/transactions`);
        revalidatePath(
            `/tenants/${tenantId}/accounts/${fromAccount.accountId}`,
        );
        revalidatePath(
            `/tenants/${tenantId}/accounts/${toAccount.accountId}`,
        );
        redirect(
            withToast(
                `/tenants/${tenantId}/transactions`,
                'success',
                'Transfer recorded',
            ),
        );
    },
);

export const deleteTransactionAction = withActorContext(
    async (tenantId: string, transactionId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const [tx] = await readModels.transactions.find({
            transactionId,
        });
        if (!tx || String(tx.tenantId) !== tenantId) {
            throw new Error('Transaction not found.');
        }

        const stream = transactionStream(transactionId);
        await aggregates.transaction.execute(
            'deleteTransaction',
            { deletedByUserId: userId, stream } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/transactions`);
        revalidatePath(`/tenants/${tenantId}/accounts/${tx.accountId}`);
        redirect(
            withToast(
                `/tenants/${tenantId}/transactions`,
                'success',
                'Transaction deleted',
            ),
        );
    },
);
