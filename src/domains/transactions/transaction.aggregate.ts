import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    TransactionRecordedEvent,
    TransactionUpdatedEvent,
    TransactionDeletedEvent,
    type TransactionStreamInstance,
    type TransactionType,
} from './transaction.events';

export type TransactionState = null | {
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
    revertsTransactionIds?: SorcUUID[];
    recordedByUserId: SorcUUID;
    recordedAt: Date;
    isDeleted: boolean;
};

export type TransactionEvent = InstanceType<
    | typeof TransactionRecordedEvent
    | typeof TransactionUpdatedEvent
    | typeof TransactionDeletedEvent
>;

export function transactionReducer(
    state: TransactionState,
    event: TransactionEvent,
): TransactionState {
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

// ----- command inputs -----

export type RecordTransactionCmd = {
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
    revertsTransactionIds?: SorcUUID[];
    recordedByUserId: SorcUUID;
    stream: TransactionStreamInstance;
};

export type UpdateTransactionCmd = {
    categoryId?: SorcUUID;
    amount?: number;
    occurredOn?: string;
    description?: string;
    updatedByUserId: SorcUUID;
    stream: TransactionStreamInstance;
};

export type DeleteTransactionCmd = {
    deletedByUserId: SorcUUID;
    stream: TransactionStreamInstance;
};

export const transactionCommands = {
    recordTransaction(
        state: TransactionState,
        cmd: RecordTransactionCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(
                `Transaction ${cmd.transactionId} already exists`,
            );
        if (cmd.amount <= 0) throw new Error('Amount must be positive.');
        ctx!.emit(
            TransactionRecordedEvent,
            {
                transactionId: cmd.transactionId,
                tenantId: cmd.tenantId,
                accountId: cmd.accountId,
                categoryId: cmd.categoryId,
                amount: cmd.amount,
                currency: cmd.currency,
                occurredOn: cmd.occurredOn,
                description: cmd.description,
                transactionType: cmd.transactionType,
                counterpartTransactionId: cmd.counterpartTransactionId,
                transferDirection: cmd.transferDirection,
                templateId: cmd.templateId,
                revertsTransactionIds: cmd.revertsTransactionIds,
                recordedByUserId: cmd.recordedByUserId,
                recordedAt: new Date(),
            } as InstanceType<typeof TransactionRecordedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    updateTransaction(
        state: TransactionState,
        cmd: UpdateTransactionCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Transaction does not exist');
        if (state.isDeleted) throw new Error('Transaction is deleted');
        if (state.transactionType === 'transfer') {
            throw new Error(
                'Transfer legs cannot be edited; delete and re-create.',
            );
        }
        if (cmd.amount !== undefined && cmd.amount <= 0) {
            throw new Error('Amount must be positive.');
        }
        ctx!.emit(
            TransactionUpdatedEvent,
            {
                transactionId: state.transactionId,
                accountId: state.accountId,
                tenantId: state.tenantId,
                transactionType: state.transactionType,
                priorAmount: state.amount,
                priorOccurredOn: state.occurredOn,
                priorCategoryId: state.categoryId,
                categoryId: cmd.categoryId,
                amount: cmd.amount,
                occurredOn: cmd.occurredOn,
                description: cmd.description,
                updatedByUserId: cmd.updatedByUserId,
                updatedAt: new Date(),
            } as InstanceType<typeof TransactionUpdatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    deleteTransaction(
        state: TransactionState,
        cmd: DeleteTransactionCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Transaction does not exist');
        if (state.isDeleted) throw new Error('Transaction already deleted');
        ctx!.emit(
            TransactionDeletedEvent,
            {
                transactionId: state.transactionId,
                accountId: state.accountId,
                tenantId: state.tenantId,
                transactionType: state.transactionType,
                amount: state.amount,
                occurredOn: state.occurredOn,
                categoryId: state.categoryId,
                transferDirection: state.transferDirection,
                deletedByUserId: cmd.deletedByUserId,
                deletedAt: new Date(),
            } as InstanceType<typeof TransactionDeletedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
