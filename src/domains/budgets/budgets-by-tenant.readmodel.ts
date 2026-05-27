import type { SorcUUID } from '@event-sorcerer/core';
import type {
    BudgetCreatedEvent,
    BudgetUpdatedEvent,
    BudgetArchivedEvent,
    RolloverPolicy,
} from './budget.events';
import type {
    TransactionRecordedEvent,
    TransactionUpdatedEvent,
    TransactionDeletedEvent,
} from '@/domains/transactions';

/**
 * `budgetsByTenant` — keyed by `categoryId` (NOT `budgetId`). Rationale:
 * the dispatch's "one Budget per (tenantId, categoryId) active at a time"
 * uniqueness lets us use categoryId as the natural per-doc key. This
 * matters because `TransactionRecorded` events carry `categoryId` not
 * `budgetId` — keying by `categoryId` means the framework routes the
 * spend-tracking events to the right doc without a side-channel lookup.
 *
 * `currentMonth.{year,month}` is the current calendar month (YYYY-MM) at
 * the time of the most recent observed transaction. Spend buckets that
 * fall in earlier months are NOT tracked here — they'd need a
 * separate per-month read model (slice 8's `monthlyAggregate` covers
 * historical reporting).
 *
 * `rollover` for `carry-forward` policy: when the month flips (we see
 * an expense in a later month), we capture the previous month's
 * remaining as `rolloverBalance` for the next month. Overspend doesn't
 * carry as debt (clamped at 0).
 */
export type BudgetDoc = {
    budgetId: SorcUUID;
    tenantId: SorcUUID;
    categoryId: SorcUUID;
    monthlyAmount: number;
    currency: string;
    rolloverPolicy: RolloverPolicy;
    isArchived: boolean;
    currentMonth: {
        year: number;
        month: number; // 1-12
        spent: number;
        rolloverBalance: number;
    };
};

export type BudgetsByTenantListenEvents = readonly [
    { readonly name: 'BudgetCreated'; readonly version: '*' },
    { readonly name: 'BudgetUpdated'; readonly version: '*' },
    { readonly name: 'BudgetArchived'; readonly version: '*' },
    { readonly name: 'TransactionRecorded'; readonly version: '*' },
    { readonly name: 'TransactionUpdated'; readonly version: '*' },
    { readonly name: 'TransactionDeleted'; readonly version: '*' },
];

export const budgetsByTenantListen: BudgetsByTenantListenEvents = [
    { name: 'BudgetCreated', version: '*' },
    { name: 'BudgetUpdated', version: '*' },
    { name: 'BudgetArchived', version: '*' },
    { name: 'TransactionRecorded', version: '*' },
    { name: 'TransactionUpdated', version: '*' },
    { name: 'TransactionDeleted', version: '*' },
] as const;

type BudgetsApplyEvent =
    | InstanceType<typeof BudgetCreatedEvent>
    | InstanceType<typeof BudgetUpdatedEvent>
    | InstanceType<typeof BudgetArchivedEvent>
    | InstanceType<typeof TransactionRecordedEvent>
    | InstanceType<typeof TransactionUpdatedEvent>
    | InstanceType<typeof TransactionDeletedEvent>;

function parseYearMonth(occurredOn: string): { year: number; month: number } {
    const [y, m] = occurredOn.split('-');
    return { year: Number(y), month: Number(m) };
}

export function budgetsByTenantKey(
    event: BudgetsApplyEvent,
): { categoryId: SorcUUID } {
    if (
        event.name === 'BudgetCreated' ||
        event.name === 'BudgetUpdated' ||
        event.name === 'BudgetArchived'
    ) {
        // Legacy BudgetUpdated/Archived (pre-Wave-F) lack categoryId on
        // the payload — no-op via sentinel routing rather than crash.
        return {
            categoryId: (event.payload.categoryId ?? '') as SorcUUID,
        };
    }
    // Transaction events. TransactionUpdated carries `priorCategoryId`;
    // if the category changed, route to the NEW one and accept that the
    // prior-category budget will be stale until cold-rebuild (single-key
    // routing limitation).
    if (event.name === 'TransactionUpdated') {
        const next =
            event.payload.categoryId !== undefined
                ? event.payload.categoryId
                : event.payload.priorCategoryId;
        return { categoryId: (next ?? '') as SorcUUID };
    }
    const txCategoryId = (event.payload as { categoryId?: SorcUUID })
        .categoryId;
    return { categoryId: (txCategoryId ?? '') as SorcUUID };
}

export function budgetsByTenantApply(
    state: BudgetDoc | null,
    event: BudgetsApplyEvent,
): BudgetDoc | null {
    switch (event.name) {
        case 'BudgetCreated': {
            const { year, month } = parseYearMonth(
                event.payload.createdAt.toISOString().slice(0, 10),
            );
            return {
                budgetId: event.payload.budgetId,
                tenantId: event.payload.tenantId,
                categoryId: event.payload.categoryId,
                monthlyAmount: event.payload.monthlyAmount,
                currency: event.payload.currency,
                rolloverPolicy: event.payload.rolloverPolicy,
                isArchived: false,
                currentMonth: {
                    year,
                    month,
                    spent: 0,
                    rolloverBalance: 0,
                },
            };
        }
        case 'BudgetUpdated': {
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
        }
        case 'BudgetArchived':
            return state ? { ...state, isArchived: true } : state;
        case 'TransactionRecorded': {
            if (!state || state.isArchived) return state;
            const tx = event.payload;
            // Only expense transactions count toward budgets.
            if (tx.transactionType !== 'expense') return state;
            const { year, month } = parseYearMonth(tx.occurredOn);
            return rollForward(state, year, month, tx.amount);
        }
        case 'TransactionUpdated': {
            if (!state || state.isArchived) return state;
            const tx = event.payload;
            if (tx.transactionType !== 'expense') return state;
            // Route landed on the NEW categoryId (see key()). If the
            // category changed, this doc is the new-category budget —
            // add the new amount as fresh spend. The prior-category
            // budget is left stale until cold-rebuild (single-key
            // routing limitation).
            const categoryChanged =
                tx.categoryId !== undefined &&
                tx.priorCategoryId !== undefined &&
                String(tx.categoryId) !== String(tx.priorCategoryId);
            const newAmount = tx.amount ?? tx.priorAmount;

            if (categoryChanged) {
                const { year, month } = parseYearMonth(
                    tx.occurredOn ?? tx.priorOccurredOn,
                );
                return rollForward(state, year, month, newAmount);
            }
            // Same category — apply net delta.
            const delta = newAmount - tx.priorAmount;
            return {
                ...state,
                currentMonth: {
                    ...state.currentMonth,
                    spent: Math.max(0, state.currentMonth.spent + delta),
                },
            };
        }
        case 'TransactionDeleted': {
            if (!state || state.isArchived) return state;
            const tx = event.payload;
            if (tx.transactionType !== 'expense') return state;
            return {
                ...state,
                currentMonth: {
                    ...state.currentMonth,
                    spent: Math.max(0, state.currentMonth.spent - tx.amount),
                },
            };
        }
        default:
            return state;
    }
}

/**
 * Apply a spend event to the budget state, handling the month-flip
 * + rollover-policy semantics:
 *   - same month: increment `spent`.
 *   - new month: snapshot prior remaining (clamped ≥ 0) into
 *     `rolloverBalance` if `rolloverPolicy === 'carry-forward'`; otherwise
 *     reset `rolloverBalance` to 0. Reset `spent` to the new amount.
 */
function rollForward(
    state: BudgetDoc,
    year: number,
    month: number,
    amount: number,
): BudgetDoc {
    const curr = state.currentMonth;
    if (year < curr.year || (year === curr.year && month < curr.month)) {
        // Out-of-order historical txn — apply to current month bucket as
        // best-effort. Historical reporting comes from monthlyAggregate.
        return {
            ...state,
            currentMonth: { ...curr, spent: curr.spent + amount },
        };
    }
    if (year === curr.year && month === curr.month) {
        return {
            ...state,
            currentMonth: { ...curr, spent: curr.spent + amount },
        };
    }
    // Month flip
    const effective = state.monthlyAmount + curr.rolloverBalance;
    const priorRemaining = Math.max(0, effective - curr.spent);
    const newRollover =
        state.rolloverPolicy === 'carry-forward' ? priorRemaining : 0;
    return {
        ...state,
        currentMonth: {
            year,
            month,
            spent: amount,
            rolloverBalance: newRollover,
        },
    };
}
