import type { SorcUUID } from '@event-sorcerer/core';
import type {
    TransactionRecordedEvent,
    TransactionUpdatedEvent,
    TransactionDeletedEvent,
    TransactionType,
} from '@/domains/transactions';

/**
 * `monthlyAggregate` — per-(tenantId, year, month) bucket. Keyed by a
 * composite string `${tenantId}:${YYYY-MM}` because the framework's
 * read-model `key()` returns a record-shaped projection and we want one
 * doc per (tenant, month).
 *
 * Listens to all three transaction events. `TransactionRecorded` adds to
 * the txn's month; `TransactionDeleted` subtracts from the txn's month
 * (denormalized `tenantId` + `occurredOn` on the payload — Wave-F fix).
 *
 * `TransactionUpdated` is a one-doc, best-effort apply: framework
 * `key()` is pure-from-event and returns ONE key per event, so a
 * cross-month update only routes to the NEW month bucket. Same-month
 * updates apply the net delta correctly; cross-month updates leave a
 * residual in the prior month until cold-rebuild via `subscribe()`.
 * The durable `transactions` read model is the source of truth for
 * ledger accuracy.
 */
export type MonthlyAggregateDoc = {
    aggregateKey: string;
    tenantId: SorcUUID;
    year: number;
    month: number; // 1-12
    income: number;
    expense: number;
    net: number;
    transferVolume: number;
    byCategory: Record<string, { income: number; expense: number }>;
};

export type MonthlyAggregateListenEvents = readonly [
    { readonly name: 'TransactionRecorded'; readonly version: '*' },
    { readonly name: 'TransactionUpdated'; readonly version: '*' },
    { readonly name: 'TransactionDeleted'; readonly version: '*' },
];

export const monthlyAggregateListen: MonthlyAggregateListenEvents = [
    { name: 'TransactionRecorded', version: '*' },
    { name: 'TransactionUpdated', version: '*' },
    { name: 'TransactionDeleted', version: '*' },
] as const;

type MonthlyApplyEvent =
    | InstanceType<typeof TransactionRecordedEvent>
    | InstanceType<typeof TransactionUpdatedEvent>
    | InstanceType<typeof TransactionDeletedEvent>;

function ymKey(tenantId: SorcUUID, occurredOn: string): string {
    return `${String(tenantId)}:${occurredOn.slice(0, 7)}`;
}

export function monthlyAggregateKey(event: MonthlyApplyEvent) {
    if (event.name === 'TransactionRecorded') {
        return {
            aggregateKey: ymKey(
                event.payload.tenantId,
                event.payload.occurredOn,
            ),
        };
    }
    if (event.name === 'TransactionDeleted') {
        // Legacy events (emitted before the Wave-F denormalization) may
        // lack tenantId/occurredOn — fall back to a sentinel that won't
        // match any doc; apply() is a safe no-op for those.
        if (!event.payload.tenantId || !event.payload.occurredOn) {
            return { aggregateKey: '' };
        }
        return {
            aggregateKey: ymKey(
                event.payload.tenantId,
                event.payload.occurredOn,
            ),
        };
    }
    // TransactionUpdated — single-key routing limitation: cross-month
    // updates only route to ONE bucket. Use the NEW occurredOn when set
    // (so the delta lands where the doc moved to); otherwise reuse the
    // priorOccurredOn (same-month update — the delta lands in place).
    const newOccurredOn =
        event.payload.occurredOn ?? event.payload.priorOccurredOn;
    if (!event.payload.tenantId || !newOccurredOn) {
        return { aggregateKey: '' };
    }
    return {
        aggregateKey: ymKey(event.payload.tenantId, newOccurredOn),
    };
}

function emptyDoc(
    tenantId: SorcUUID,
    occurredOn: string,
): MonthlyAggregateDoc {
    const ym = occurredOn.slice(0, 7);
    const [yStr, mStr] = ym.split('-');
    return {
        aggregateKey: ymKey(tenantId, occurredOn),
        tenantId,
        year: Number(yStr),
        month: Number(mStr),
        income: 0,
        expense: 0,
        net: 0,
        transferVolume: 0,
        byCategory: {},
    };
}

function applyDelta(
    base: MonthlyAggregateDoc,
    type: TransactionType,
    categoryId: SorcUUID | undefined,
    delta: number,
): MonthlyAggregateDoc {
    const cat = categoryId ? String(categoryId) : '__uncategorized';
    const prev = base.byCategory[cat] ?? { income: 0, expense: 0 };

    if (type === 'income') {
        return {
            ...base,
            income: base.income + delta,
            net: base.net + delta,
            byCategory: {
                ...base.byCategory,
                [cat]: { ...prev, income: prev.income + delta },
            },
        };
    }
    if (type === 'expense') {
        return {
            ...base,
            expense: base.expense + delta,
            net: base.net - delta,
            byCategory: {
                ...base.byCategory,
                [cat]: { ...prev, expense: prev.expense + delta },
            },
        };
    }
    // transfer — both legs contribute to volume; net stays zero.
    return {
        ...base,
        transferVolume: base.transferVolume + delta,
    };
}

export function monthlyAggregateApply(
    state: MonthlyAggregateDoc | null,
    event: MonthlyApplyEvent,
): MonthlyAggregateDoc | null {
    switch (event.name) {
        case 'TransactionRecorded': {
            const p = event.payload;
            const base = state ?? emptyDoc(p.tenantId, p.occurredOn);
            return applyDelta(base, p.transactionType, p.categoryId, p.amount);
        }
        case 'TransactionDeleted': {
            const p = event.payload;
            // No doc to subtract from (e.g. cold-rebuild dropped it,
            // or routing miss). Safer to no-op than to materialize a
            // negative doc.
            if (!state) return state;
            return applyDelta(
                state,
                p.transactionType,
                p.categoryId,
                -p.amount,
            );
        }
        case 'TransactionUpdated': {
            const p = event.payload;
            // Legacy events (pre-Wave-F denormalization) lack the
            // required prior* fields — silently no-op rather than crash.
            if (!p.tenantId || !p.priorOccurredOn) return state;
            // Cross-month update: routing brings us to the NEW month
            // bucket only. If state is null, materialize an empty doc
            // for the new month and add the new amount. The prior
            // month's residual is left until cold-rebuild.
            const newOccurredOn = p.occurredOn ?? p.priorOccurredOn;
            const newAmount = p.amount ?? p.priorAmount;
            const newCategoryId =
                p.categoryId !== undefined ? p.categoryId : p.priorCategoryId;
            const sameMonth =
                newOccurredOn.slice(0, 7) === p.priorOccurredOn.slice(0, 7);

            if (sameMonth && state) {
                // Reverse prior contribution + apply new contribution to
                // this single doc. Category may have changed within the
                // same month — apply both legs to the right buckets.
                const reversed = applyDelta(
                    state,
                    p.transactionType,
                    p.priorCategoryId,
                    -p.priorAmount,
                );
                return applyDelta(
                    reversed,
                    p.transactionType,
                    newCategoryId,
                    newAmount,
                );
            }
            // Cross-month: route landed on the new-month doc. Add the
            // new contribution; prior-month doc is stale until cold-rebuild.
            const base = state ?? emptyDoc(p.tenantId, newOccurredOn);
            return applyDelta(
                base,
                p.transactionType,
                newCategoryId,
                newAmount,
            );
        }
        default:
            return state;
    }
}
