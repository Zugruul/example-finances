import {
    SorcBaseEvent,
    SorcStreamInstance,
    SorcStreamPattern,
    SorcPayload,
    SorcUUID,
    domain,
    foreign,
    property,
} from '@event-sorcerer/core';

export type BudgetStreamInstance = SorcStreamInstance<`budget-${string}`>;
export type BudgetStreamPattern = SorcStreamPattern<`budget-${string}`>;

export type RolloverPolicy = 'none' | 'carry-forward' | 'reset';

// ----- payloads -----

@domain('budgets')
export class BudgetCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    budgetId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('categories')
    @property({ type: 'uuid', required: true })
    categoryId!: SorcUUID;

    @property({ type: 'number', required: true })
    monthlyAmount!: number;

    @property({ type: 'string', required: true })
    currency!: string;

    @property({ type: 'string', required: true })
    rolloverPolicy!: RolloverPolicy;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    createdByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('budgets')
export class BudgetUpdatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    budgetId!: SorcUUID;

    @property({ type: 'number' })
    monthlyAmount?: number;

    @property({ type: 'string' })
    rolloverPolicy?: RolloverPolicy;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    updatedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('budgets')
export class BudgetArchivedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    budgetId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    archivedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    archivedAt!: Date;
}

// ----- events -----

@domain('budgets')
export class BudgetCreatedEvent extends SorcBaseEvent {
    readonly name = 'BudgetCreated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: BudgetStreamInstance,
        public payload: BudgetCreatedPayload,
    ) {
        super();
    }
}

@domain('budgets')
export class BudgetUpdatedEvent extends SorcBaseEvent {
    readonly name = 'BudgetUpdated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: BudgetStreamInstance,
        public payload: BudgetUpdatedPayload,
    ) {
        super();
    }
}

@domain('budgets')
export class BudgetArchivedEvent extends SorcBaseEvent {
    readonly name = 'BudgetArchived' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: BudgetStreamInstance,
        public payload: BudgetArchivedPayload,
    ) {
        super();
    }
}

export const budgetEvents = [
    BudgetCreatedEvent,
    BudgetUpdatedEvent,
    BudgetArchivedEvent,
] as const;
