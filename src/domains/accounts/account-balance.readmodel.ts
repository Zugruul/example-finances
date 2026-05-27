import type { SorcUUID } from '@event-sorcerer/core';
import { type AccountCreatedEvent } from './account.events';
import type {
    TransactionRecordedEvent,
    TransactionUpdatedEvent,
    TransactionDeletedEvent,
} from '@/domains/transactions';

/**
 * `accountBalance` — per-account running balance in integer minor units.
 *
 * Listens to `AccountCreated` (initial value from openingBalance) and the
 * three transaction events. Transaction Update/Delete payloads denormalize
 * `accountId` + `transactionType` + (prior) amount at emit-time so the
 * listener can compute deltas purely from event data — no read-side
 * lookup needed and the projection is idempotent under replay.
 *
 * Sign rules:
 *   - `transactionType === 'income'`  → balance += amount
 *   - `transactionType === 'expense'` → balance -= amount
 *   - `transactionType === 'transfer'`→ slice 5 wires direction-aware sign
 */
export type AccountBalanceDoc = {
    accountId: SorcUUID;
    tenantId: SorcUUID;
    balance: number;
    currency: string;
    lastTransactionAt?: number;
};

export type AccountBalanceListenEvents = readonly [
    { readonly name: 'AccountCreated'; readonly version: '*' },
    { readonly name: 'TransactionRecorded'; readonly version: '*' },
    { readonly name: 'TransactionUpdated'; readonly version: '*' },
    { readonly name: 'TransactionDeleted'; readonly version: '*' },
];

export const accountBalanceListen: AccountBalanceListenEvents = [
    { name: 'AccountCreated', version: '*' },
    { name: 'TransactionRecorded', version: '*' },
    { name: 'TransactionUpdated', version: '*' },
    { name: 'TransactionDeleted', version: '*' },
] as const;

type AccountBalanceApplyEvent =
    | InstanceType<typeof AccountCreatedEvent>
    | InstanceType<typeof TransactionRecordedEvent>
    | InstanceType<typeof TransactionUpdatedEvent>
    | InstanceType<typeof TransactionDeletedEvent>;

function signedDelta(
    transactionType: 'income' | 'expense' | 'transfer',
    amount: number,
    transferDirection?: 'debit' | 'credit',
): number {
    if (transactionType === 'income') return amount;
    if (transactionType === 'expense') return -amount;
    // transfer: per-leg direction. 'debit' on source, 'credit' on destination.
    // If direction is missing (older event, mis-emitted leg), no-op rather
    // than guess.
    if (transferDirection === 'credit') return amount;
    if (transferDirection === 'debit') return -amount;
    return 0;
}

export function accountBalanceKey(event: AccountBalanceApplyEvent) {
    return { accountId: event.payload.accountId };
}

export function accountBalanceApply(
    state: AccountBalanceDoc | null,
    event: AccountBalanceApplyEvent,
): AccountBalanceDoc | null {
    switch (event.name) {
        case 'AccountCreated':
            return {
                accountId: event.payload.accountId,
                tenantId: event.payload.tenantId,
                balance: event.payload.openingBalance,
                currency: event.payload.currency,
            };
        case 'TransactionRecorded': {
            if (!state) return state;
            const t = event.payload;
            const delta = signedDelta(
                t.transactionType,
                t.amount,
                t.transferDirection,
            );
            return {
                ...state,
                balance: state.balance + delta,
                lastTransactionAt: t.recordedAt.getTime(),
            };
        }
        case 'TransactionUpdated': {
            if (!state) return state;
            const t = event.payload;
            if (t.amount === undefined) return state; // no amount change
            // Update can't apply to transfer legs (aggregate forbids it),
            // so transferDirection isn't needed here.
            const priorDelta = signedDelta(t.transactionType, t.priorAmount);
            const newDelta = signedDelta(t.transactionType, t.amount);
            return {
                ...state,
                balance: state.balance - priorDelta + newDelta,
                lastTransactionAt: t.updatedAt.getTime(),
            };
        }
        case 'TransactionDeleted': {
            if (!state) return state;
            const t = event.payload;
            const reversed = signedDelta(
                t.transactionType,
                t.amount,
                t.transferDirection,
            );
            return {
                ...state,
                balance: state.balance - reversed,
                lastTransactionAt: t.deletedAt.getTime(),
            };
        }
        default:
            return state;
    }
}
