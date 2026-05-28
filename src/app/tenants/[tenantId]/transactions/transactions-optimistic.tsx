'use client';

import {
    createContext,
    useContext,
    useOptimistic,
    type ReactNode,
} from 'react';
import type { LedgerRow } from './transactions-ledger';
import { parseAmountToMinor } from '@/lib/money';

/**
 * Optimistic-ledger plumbing for `/tenants/[id]/transactions`. The
 * server-rendered form and the (also server-rendered) ledger card are
 * separated by the QuickPickTemplates + TemplateHoverRoot blocks, so
 * there's no parent component that owns both. Instead we put a thin
 * client-side context provider around the whole page region:
 *
 *   <TransactionsOptimisticProvider accountById={...} categoryById={...}>
 *     ...the ledger... (reads `pending` via useOptimisticPending and
 *                       prepends to its rows)
 *     ...the form... (uses OptimisticRecordForm which adds a ghost row
 *                     to `pending` on submit, then calls the server
 *                     action via the form's `action={}`)
 *   </TransactionsOptimisticProvider>
 *
 * React 19's `useOptimistic` auto-resets the pending list when the
 * form-action transition resolves — which is when the server returns,
 * redirect happens, and Next.js soft-navigates to the next render
 * (which has the real row in `rows` from a revalidated query).
 *
 * Limitation: if the read-model subscriber lags past the soft-nav,
 * there's a sub-second flash where the optimistic ghost disappears
 * before the real row shows up. The revalidatePath broadening +
 * useOptimistic combo covers the common case; the framework-side
 * `publishAndWaitForProjection` primitive would close this gap. We
 * decided not to ship that yet — see research-stale-data.md.
 */

/**
 * Plain-JSON snapshots passed from the server component so the
 * optimistic-row builder can resolve account / category metadata
 * without re-querying.
 */
export type AccountLite = {
    name: string;
    currency: string;
    isClosed: boolean;
};

export type CategoryLite = {
    name: string;
};

type OptimisticContextValue = {
    /** Newest-first list of optimistic rows the user has just recorded. */
    pending: LedgerRow[];
    /** Push a ghost row built from a submitted form's FormData. */
    push: (row: LedgerRow) => void;
    accountById: Record<string, AccountLite>;
    categoryById: Record<string, CategoryLite>;
};

const TransactionsOptimisticContext =
    createContext<OptimisticContextValue | null>(null);

function useOptimisticContext(): OptimisticContextValue {
    const ctx = useContext(TransactionsOptimisticContext);
    if (!ctx) {
        throw new Error(
            'TransactionsOptimisticContext missing — wrap the section in <TransactionsOptimisticProvider>.',
        );
    }
    return ctx;
}

export function useOptimisticPending(): LedgerRow[] {
    return useOptimisticContext().pending;
}

export function TransactionsOptimisticProvider({
    accountById,
    categoryById,
    children,
}: {
    accountById: Record<string, AccountLite>;
    categoryById: Record<string, CategoryLite>;
    children: ReactNode;
}) {
    const [pending, push] = useOptimistic<LedgerRow[], LedgerRow>(
        [],
        (state, row) => [row, ...state],
    );
    return (
        <TransactionsOptimisticContext.Provider
            value={{ pending, push, accountById, categoryById }}
        >
            {children}
        </TransactionsOptimisticContext.Provider>
    );
}

/**
 * Build the optimistic ledger row from a submitted FormData. Returns
 * null if the data isn't shaped like a valid record-transaction
 * submission (in which case we just submit to the server without
 * showing a ghost — the server will reject and we'd rather not lie).
 */
function buildOptimisticRow(
    formData: FormData,
    accountById: Record<string, AccountLite>,
    categoryById: Record<string, CategoryLite>,
): LedgerRow | null {
    const accountId = String(formData.get('accountId') ?? '').trim();
    const account = accountById[accountId];
    if (!account) return null;

    const amountRaw = String(formData.get('amount') ?? '').trim();
    const amount = parseAmountToMinor(amountRaw, account.currency);
    if (amount === null || amount === 0) return null;

    const transactionType = String(
        formData.get('transactionType') ?? '',
    ).trim();
    if (transactionType !== 'income' && transactionType !== 'expense') {
        return null;
    }

    const occurredOn = String(formData.get('occurredOn') ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return null;

    const description =
        String(formData.get('description') ?? '').trim() || null;
    const categoryId = String(formData.get('categoryId') ?? '').trim();
    const category = categoryId ? (categoryById[categoryId] ?? null) : null;

    // Client-side temp id. The server will assign a real uuidv7; once
    // the read model lands with the real row, useOptimistic's transition
    // clears this ghost so there's no duplicate. The id only has to
    // remain unique within the pending list for React's key prop.
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
        transactionId: tempId,
        accountId,
        accountName: account.name,
        categoryName: category?.name ?? null,
        amount,
        currency: account.currency,
        occurredOn,
        description,
        transactionType,
        recordedAtIso: new Date().toISOString(),
    };
}

/**
 * Drop-in replacement for `<form action={recordAction}>`. Pushes a
 * ghost ledger row on submit BEFORE handing the FormData to the bound
 * server action. Children + every other prop pass straight through to
 * the underlying <form>.
 */
export function OptimisticRecordForm({
    action,
    children,
    ...rest
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> & {
    action: (formData: FormData) => Promise<void> | void;
}) {
    const { push, accountById, categoryById } = useOptimisticContext();

    async function wrappedAction(formData: FormData) {
        const row = buildOptimisticRow(formData, accountById, categoryById);
        if (row) push(row);
        await action(formData);
    }

    return (
        <form action={wrappedAction} {...rest}>
            {children}
        </form>
    );
}
