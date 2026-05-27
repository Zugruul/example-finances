import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    BudgetCreatedEvent,
    BudgetUpdatedEvent,
    BudgetArchivedEvent,
    type BudgetStreamInstance,
    type RolloverPolicy,
} from './budget.events';

export type BudgetState = null | {
    budgetId: SorcUUID;
    tenantId: SorcUUID;
    categoryId: SorcUUID;
    monthlyAmount: number;
    currency: string;
    rolloverPolicy: RolloverPolicy;
    createdByUserId: SorcUUID;
    createdAt: Date;
    isArchived: boolean;
};

export type BudgetEvent = InstanceType<
    | typeof BudgetCreatedEvent
    | typeof BudgetUpdatedEvent
    | typeof BudgetArchivedEvent
>;

export function budgetReducer(
    state: BudgetState,
    event: BudgetEvent,
): BudgetState {
    switch (event.name) {
        case 'BudgetCreated':
            return {
                budgetId: event.payload.budgetId,
                tenantId: event.payload.tenantId,
                categoryId: event.payload.categoryId,
                monthlyAmount: event.payload.monthlyAmount,
                currency: event.payload.currency,
                rolloverPolicy: event.payload.rolloverPolicy,
                createdByUserId: event.payload.createdByUserId,
                createdAt: event.payload.createdAt,
                isArchived: false,
            };
        case 'BudgetUpdated':
            if (!state) return state;
            return {
                ...state,
                monthlyAmount:
                    event.payload.monthlyAmount !== undefined
                        ? event.payload.monthlyAmount
                        : state.monthlyAmount,
                rolloverPolicy:
                    event.payload.rolloverPolicy !== undefined
                        ? event.payload.rolloverPolicy
                        : state.rolloverPolicy,
            };
        case 'BudgetArchived':
            return state ? { ...state, isArchived: true } : state;
        default:
            return state;
    }
}

// ----- command inputs -----

export type CreateBudgetCmd = {
    budgetId: SorcUUID;
    tenantId: SorcUUID;
    categoryId: SorcUUID;
    monthlyAmount: number;
    currency: string;
    rolloverPolicy: RolloverPolicy;
    createdByUserId: SorcUUID;
    stream: BudgetStreamInstance;
};

export type UpdateBudgetCmd = {
    monthlyAmount?: number;
    rolloverPolicy?: RolloverPolicy;
    updatedByUserId: SorcUUID;
    stream: BudgetStreamInstance;
};

export type ArchiveBudgetCmd = {
    archivedByUserId: SorcUUID;
    stream: BudgetStreamInstance;
};

export const budgetCommands = {
    createBudget(
        state: BudgetState,
        cmd: CreateBudgetCmd,
        ctx?: CommandContext,
    ): void {
        if (state) throw new Error(`Budget ${cmd.budgetId} already exists`);
        if (cmd.monthlyAmount < 0) {
            throw new Error('Monthly amount must be non-negative.');
        }
        ctx!.emit(
            BudgetCreatedEvent,
            {
                budgetId: cmd.budgetId,
                tenantId: cmd.tenantId,
                categoryId: cmd.categoryId,
                monthlyAmount: cmd.monthlyAmount,
                currency: cmd.currency,
                rolloverPolicy: cmd.rolloverPolicy,
                createdByUserId: cmd.createdByUserId,
                createdAt: new Date(),
            } as InstanceType<typeof BudgetCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    updateBudget(
        state: BudgetState,
        cmd: UpdateBudgetCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Budget does not exist');
        if (state.isArchived) throw new Error('Budget is archived');
        if (cmd.monthlyAmount !== undefined && cmd.monthlyAmount < 0) {
            throw new Error('Monthly amount must be non-negative.');
        }
        ctx!.emit(
            BudgetUpdatedEvent,
            {
                budgetId: state.budgetId,
                categoryId: state.categoryId,
                monthlyAmount: cmd.monthlyAmount,
                rolloverPolicy: cmd.rolloverPolicy,
                updatedByUserId: cmd.updatedByUserId,
                updatedAt: new Date(),
            } as InstanceType<typeof BudgetUpdatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    archiveBudget(
        state: BudgetState,
        cmd: ArchiveBudgetCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Budget does not exist');
        if (state.isArchived) throw new Error('Budget already archived');
        ctx!.emit(
            BudgetArchivedEvent,
            {
                budgetId: state.budgetId,
                categoryId: state.categoryId,
                archivedByUserId: cmd.archivedByUserId,
                archivedAt: new Date(),
            } as InstanceType<typeof BudgetArchivedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
