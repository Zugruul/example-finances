import type { SorcUUID } from '@event-sorcerer/core';
import type {
    TransactionRecordedEvent,
    TransactionDeletedEvent,
} from '@/domains/transactions';

/**
 * `monthlyAggregate` — per-(tenantId, year, month) bucket. Keyed by a
 * composite string `${tenantId}:${YYYY-MM}` because the framework's
 * read-model `key()` returns a record-shaped projection and we want one
 * doc per (tenant, month).
 *
 * Listens to `TransactionRecorded` + `TransactionDeleted` only. `TransactionUpdated`
 * doesn't carry occurredOn — the doc won't reflect updates until the
 * tenant's transactions are replayed via cold-rebuild. Acceptable for the
 * dashboard's "this month" view (slice 8 dashboard is best-effort historical;
 * the durable transactions read model is the source of truth for ledger
 * accuracy).
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
    { readonly name: 'TransactionDeleted'; readonly version: '*' },
];

export const monthlyAggregateListen: MonthlyAggregateListenEvents = [
    { name: 'TransactionRecorded', version: '*' },
    { name: 'TransactionDeleted', version: '*' },
] as const;

type MonthlyApplyEvent =
    | InstanceType<typeof TransactionRecordedEvent>
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
    // TransactionDeleted doesn't carry tenantId or occurredOn — the
    // monthlyAggregate doc won't auto-update on delete. Return a sentinel
    // that won't match any existing doc; apply() is a no-op for these.
    // Historical reporting accuracy on delete is best-served by a
    // cold-rebuild via subscribe(). See [[domains-monthly-aggregates]].
    return { aggregateKey: '' };
}

export function monthlyAggregateApply(
    state: MonthlyAggregateDoc | null,
    event: MonthlyApplyEvent,
): MonthlyAggregateDoc | null {
    switch (event.name) {
        case 'TransactionRecorded': {
            const p = event.payload;
            const ym = p.occurredOn.slice(0, 7);
            const [yStr, mStr] = ym.split('-');
            const year = Number(yStr);
            const month = Number(mStr);
            const key = ymKey(p.tenantId, p.occurredOn);

            const base: MonthlyAggregateDoc = state ?? {
                aggregateKey: key,
                tenantId: p.tenantId,
                year,
                month,
                income: 0,
                expense: 0,
                net: 0,
                transferVolume: 0,
                byCategory: {},
            };

            const cat = p.categoryId ? String(p.categoryId) : '__uncategorized';
            const prev = base.byCategory[cat] ?? { income: 0, expense: 0 };

            if (p.transactionType === 'income') {
                return {
                    ...base,
                    income: base.income + p.amount,
                    net: base.net + p.amount,
                    byCategory: {
                        ...base.byCategory,
                        [cat]: { ...prev, income: prev.income + p.amount },
                    },
                };
            }
            if (p.transactionType === 'expense') {
                return {
                    ...base,
                    expense: base.expense + p.amount,
                    net: base.net - p.amount,
                    byCategory: {
                        ...base.byCategory,
                        [cat]: { ...prev, expense: prev.expense + p.amount },
                    },
                };
            }
            // transfer — both legs contribute to volume; net stays zero.
            return {
                ...base,
                transferVolume: base.transferVolume + p.amount,
            };
        }
        case 'TransactionDeleted':
            return state;
        default:
            return state;
    }
}
