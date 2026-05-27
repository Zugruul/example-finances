import type { SorcUUID } from '@event-sorcerer/core';
import {
    type TransactionRecordedEvent,
    type TransactionUpdatedEvent,
    type TransactionDeletedEvent,
    type TransactionType,
} from './transaction.events';

/**
 * Single per-transaction doc shared by the `transactionsByTenant` /
 * `transactionsByAccount` / `transactionsByCategory` read models. We
 * register ONE collection (`rm_transactions`) with multiple secondary
 * indexes rather than maintaining three parallel collections — same
 * doc shape, same apply, less plumbing. The framework's read-model API
 * lets us register the same listen list under one name; the
 * `accessors` exposed from `index.ts` document the intended query
 * shapes against this single collection.
 */
export type TransactionDoc = {
    transactionId: SorcUUID;
    tenantId: SorcUUID;
    accountId: SorcUUID;
    categoryId?: SorcUUID;
    amount: number;
    currency: string;
    occurredOn: string;
    description?: string;
    transactionType: TransactionType;
    counterpartTransactionId?: SorcUUID;
    transferDirection?: 'debit' | 'credit';
    templateId?: SorcUUID;
    /** When this row is itself a revert, the ids of the originals it reverses. */
    revertsTransactionIds?: SorcUUID[];
    recordedByUserId: SorcUUID;
    recordedAt: Date;
    isDeleted: boolean;
};

export type TransactionsListenEvents = readonly [
    { readonly name: 'TransactionRecorded'; readonly version: '*' },
    { readonly name: 'TransactionUpdated'; readonly version: '*' },
    { readonly name: 'TransactionDeleted'; readonly version: '*' },
];

export const transactionsListen: TransactionsListenEvents = [
    { name: 'TransactionRecorded', version: '*' },
    { name: 'TransactionUpdated', version: '*' },
    { name: 'TransactionDeleted', version: '*' },
] as const;

type TransactionsApplyEvent =
    | InstanceType<typeof TransactionRecordedEvent>
    | InstanceType<typeof TransactionUpdatedEvent>
    | InstanceType<typeof TransactionDeletedEvent>;

export function transactionsKey(event: TransactionsApplyEvent) {
    return { transactionId: event.payload.transactionId };
}

export function transactionsApply(
    state: TransactionDoc | null,
    event: TransactionsApplyEvent,
): TransactionDoc | null {
    switch (event.name) {
        case 'TransactionRecorded':
            return {
                transactionId: event.payload.transactionId,
                tenantId: event.payload.tenantId,
                accountId: event.payload.accountId,
                categoryId: event.payload.categoryId,
                amount: event.payload.amount,
                currency: event.payload.currency,
                occurredOn: event.payload.occurredOn,
                description: event.payload.description,
                transactionType: event.payload.transactionType,
                counterpartTransactionId:
                    event.payload.counterpartTransactionId,
                transferDirection: event.payload.transferDirection,
                templateId: event.payload.templateId,
                revertsTransactionIds:
                    event.payload.revertsTransactionIds,
                recordedByUserId: event.payload.recordedByUserId,
                recordedAt: event.payload.recordedAt,
                isDeleted: false,
            };
        case 'TransactionUpdated':
            if (!state || state.isDeleted) return state;
            return {
                ...state,
                categoryId:
                    event.payload.categoryId !== undefined
                        ? event.payload.categoryId
                        : state.categoryId,
                amount:
                    event.payload.amount !== undefined
                        ? event.payload.amount
                        : state.amount,
                occurredOn:
                    event.payload.occurredOn !== undefined
                        ? event.payload.occurredOn
                        : state.occurredOn,
                description:
                    event.payload.description !== undefined
                        ? event.payload.description
                        : state.description,
            };
        case 'TransactionDeleted':
            return state ? { ...state, isDeleted: true } : state;
        default:
            return state;
    }
}
