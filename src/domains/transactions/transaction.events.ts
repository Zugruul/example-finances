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

export type TransactionStreamInstance =
    SorcStreamInstance<`transaction-${string}`>;
export type TransactionStreamPattern =
    SorcStreamPattern<`transaction-${string}`>;

/**
 * Transaction discriminator. `income` and `expense` are independent
 * single-account events. `transfer` is emitted as a PAIR — one event on
 * the source account stream and one on the destination, linked via
 * `counterpartTransactionId`. The aggregate represents each leg
 * independently; consumers sum them through the `accountBalance`
 * listener (positive on destination, negative on source).
 *
 * Sign convention: `amount` is ALWAYS positive on the wire. The listener
 * derives the sign from `type` (+ for income / transfer-credit, − for
 * expense / transfer-debit; transfer-debit/credit distinguished via the
 * stream's accountId vs `counterpartTransactionId` direction).
 */
export type TransactionType = 'income' | 'expense' | 'transfer';

// ----- payloads -----

@domain('transactions')
export class TransactionRecordedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    transactionId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('accounts')
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    @foreign('categories')
    @property({ type: 'uuid' })
    categoryId?: SorcUUID;

    @property({ type: 'number', required: true })
    amount!: number;

    @property({ type: 'string', required: true })
    currency!: string;

    /** YYYY-MM-DD; intentionally a string not a Date. */
    @property({ type: 'string', required: true })
    occurredOn!: string;

    @property({ type: 'string', tags: ['pii'] })
    description?: string;

    @property({ type: 'string', required: true })
    transactionType!: TransactionType;

    /**
     * Set on transfer-leg events to link the source/destination pair.
     * @foreign('transactions') self-reference.
     */
    @foreign('transactions')
    @property({ type: 'uuid' })
    counterpartTransactionId?: SorcUUID;

    /**
     * When this transaction reverses one or more prior transactions, the
     * IDs of those originals. A single revert can target multiple
     * originals (mass-revert) PROVIDED they all sit on the same account
     * — the revert itself is a single transaction on one account.
     *
     * Stored as `type: 'object'` so the framework round-trips it as a
     * structured array on the wire; the @foreign references aren't
     * tracked at element level today (single-uuid only).
     */
    @property({ type: 'object' })
    revertsTransactionIds?: SorcUUID[];

    /**
     * For transfer legs only: which side of the transfer this event
     * represents. `'debit'` on the source account (balance subtracts),
     * `'credit'` on the destination account (balance adds). Undefined
     * for non-transfer events. Lets the `accountBalance` listener derive
     * the per-leg sign without needing the paired event.
     */
    @property({ type: 'string' })
    transferDirection?: 'debit' | 'credit';

    /** Set when materialized from a recurring template. */
    @foreign('recurring-templates')
    @property({ type: 'uuid' })
    templateId?: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    recordedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    recordedAt!: Date;
}

@domain('transactions')
export class TransactionUpdatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    transactionId!: SorcUUID;

    /**
     * Denormalized from the transaction's owning account at emit-time.
     * Lets per-account read models (e.g. `accountBalance`) key off
     * the payload directly without a transactionId → accountId lookup.
     */
    @foreign('accounts')
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    /**
     * Denormalized tenantId so per-tenant read models
     * (`monthlyAggregate`, `budgetsByTenant`) can route directly off the
     * payload without a transactionId → tenant lookup.
     */
    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    /**
     * Denormalized transactionType from the recorded leg. Lets
     * balance/aggregate consumers compute deltas without a prior-state
     * lookup at apply-time.
     */
    @property({ type: 'string', required: true })
    transactionType!: TransactionType;

    /**
     * Prior amount (before update). Carrying both before + after on the
     * payload lets the `accountBalance` listener apply the net delta
     * idempotently from event data alone.
     */
    @property({ type: 'number', required: true })
    priorAmount!: number;

    /**
     * Prior occurredOn (the month bucket this txn was in before update).
     * Required so `monthlyAggregate` can route to the right per-month
     * doc even when the update doesn't change `occurredOn`.
     */
    @property({ type: 'string', required: true })
    priorOccurredOn!: string;

    /**
     * Prior categoryId (may be undefined if the txn was previously
     * uncategorized). Lets `budgetsByTenant` route to the prior bucket
     * for delta math.
     */
    @foreign('categories')
    @property({ type: 'uuid' })
    priorCategoryId?: SorcUUID;

    @foreign('categories')
    @property({ type: 'uuid' })
    categoryId?: SorcUUID;

    @property({ type: 'number' })
    amount?: number;

    @property({ type: 'string' })
    occurredOn?: string;

    @property({ type: 'string', tags: ['pii'] })
    description?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    updatedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('transactions')
export class TransactionDeletedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    transactionId!: SorcUUID;

    /** Denormalized — see TransactionUpdatedPayload.accountId. */
    @foreign('accounts')
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    /** Denormalized — see TransactionUpdatedPayload.tenantId. */
    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    /** Denormalized transactionType (for delta sign at delete-time). */
    @property({ type: 'string', required: true })
    transactionType!: TransactionType;

    /** Amount being reversed (so listeners can subtract without prior state). */
    @property({ type: 'number', required: true })
    amount!: number;

    /**
     * Denormalized occurredOn so `monthlyAggregate` can subtract from
     * the right per-month bucket without a transactionId lookup.
     */
    @property({ type: 'string', required: true })
    occurredOn!: string;

    /**
     * Denormalized categoryId (may be undefined if uncategorized).
     * Lets `budgetsByTenant` decrement the right per-category bucket.
     */
    @foreign('categories')
    @property({ type: 'uuid' })
    categoryId?: SorcUUID;

    /** For transfer-leg deletes: which side this leg was. */
    @property({ type: 'string' })
    transferDirection?: 'debit' | 'credit';

    @foreign('users')
    @property({ type: 'uuid', required: true })
    deletedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    deletedAt!: Date;
}

// ----- events -----

@domain('transactions')
export class TransactionRecordedEvent extends SorcBaseEvent {
    readonly name = 'TransactionRecorded' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TransactionStreamInstance,
        public payload: TransactionRecordedPayload,
    ) {
        super();
    }
}

@domain('transactions')
export class TransactionUpdatedEvent extends SorcBaseEvent {
    readonly name = 'TransactionUpdated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TransactionStreamInstance,
        public payload: TransactionUpdatedPayload,
    ) {
        super();
    }
}

@domain('transactions')
export class TransactionDeletedEvent extends SorcBaseEvent {
    readonly name = 'TransactionDeleted' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TransactionStreamInstance,
        public payload: TransactionDeletedPayload,
    ) {
        super();
    }
}

export const transactionEvents = [
    TransactionRecordedEvent,
    TransactionUpdatedEvent,
    TransactionDeletedEvent,
] as const;
