'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { MoreHorizontalIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatMoney } from '@/lib/money';

export type LedgerRow = {
    transactionId: string;
    accountId: string;
    accountName: string;
    categoryName: string | null;
    amount: number;
    currency: string;
    occurredOn: string;
    description: string | null;
    transactionType: 'income' | 'expense' | 'transfer';
    transferDirection?: 'debit' | 'credit';
    revertsTransactionIds?: string[];
    recordedAtIso: string;
};

interface Props {
    tenantId: string;
    rows: LedgerRow[];
    canRecord: boolean;
    /** Server action bound with tenantId; takes FormData with `ids` (csv). */
    revertAction: (formData: FormData) => Promise<void> | void;
}

type ViewMode = 'ledger' | 'transactions';

type ChainState = {
    isRevert: boolean;
    revertedBy: string | null; // id of the latest revert pointed at this tx
    isCurrentlyReverted: boolean; // revertedBy exists AND that revert hasn't itself been reverted
    chainRootId: string; // id of the chain root (original) — for grouping in Ledger mode
};

function buildChainStates(rows: LedgerRow[]): Map<string, ChainState> {
    const byId = new Map(rows.map((r) => [r.transactionId, r] as const));

    // revertsByTarget[targetId] = latest tx (by recordedAt) whose
    // revertsTransactionIds includes targetId.
    const revertsByTarget = new Map<string, LedgerRow>();
    for (const r of rows) {
        if (!r.revertsTransactionIds?.length) continue;
        for (const tid of r.revertsTransactionIds) {
            const prev = revertsByTarget.get(tid);
            if (!prev || r.recordedAtIso > prev.recordedAtIso) {
                revertsByTarget.set(tid, r);
            }
        }
    }

    // For each tx, walk backward through `revertsTransactionIds[0]` chain
    // to find the chain root (an original that isn't itself a revert).
    function findRoot(id: string, seen = new Set<string>()): string {
        if (seen.has(id)) return id;
        seen.add(id);
        const t = byId.get(id);
        if (!t || !t.revertsTransactionIds?.length) return id;
        return findRoot(t.revertsTransactionIds[0]!, seen);
    }

    const out = new Map<string, ChainState>();
    for (const r of rows) {
        const isRevert = !!r.revertsTransactionIds?.length;
        const revert = revertsByTarget.get(r.transactionId) ?? null;
        const revertedBy = revert?.transactionId ?? null;
        const revertOfRevert = revert
            ? (revertsByTarget.get(revert.transactionId) ?? null)
            : null;
        const isCurrentlyReverted = !!revert && !revertOfRevert;
        out.set(r.transactionId, {
            isRevert,
            revertedBy,
            isCurrentlyReverted,
            chainRootId: findRoot(r.transactionId),
        });
    }
    return out;
}

/**
 * Reorder rows so that in Ledger mode, each revert appears immediately
 * after its target original (so chains read top-to-bottom: original,
 * revert, optional re-apply, …). Originals stay in their date-desc order.
 *
 * The input is already sorted newest-first. We bucket by chain root and
 * emit the root first followed by its chain in chronological order
 * (oldest revert first → newest revert last under the root).
 */
function groupForLedger(
    rows: LedgerRow[],
    chains: Map<string, ChainState>,
): LedgerRow[] {
    const rootRows: LedgerRow[] = [];
    const childrenByRoot = new Map<string, LedgerRow[]>();
    for (const r of rows) {
        const cs = chains.get(r.transactionId)!;
        if (cs.chainRootId === r.transactionId) {
            rootRows.push(r);
        } else {
            const arr = childrenByRoot.get(cs.chainRootId) ?? [];
            arr.push(r);
            childrenByRoot.set(cs.chainRootId, arr);
        }
    }
    const out: LedgerRow[] = [];
    for (const root of rootRows) {
        out.push(root);
        const kids = childrenByRoot.get(root.transactionId) ?? [];
        // Oldest revert first under the root.
        kids.sort((a, b) =>
            a.recordedAtIso < b.recordedAtIso ? -1 : 1,
        );
        out.push(...kids);
    }
    return out;
}

export function TransactionsLedger({
    tenantId,
    rows,
    canRecord,
    revertAction,
}: Props) {
    const [mode, setMode] = useState<ViewMode>('ledger');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();

    const chains = useMemo(() => buildChainStates(rows), [rows]);

    const visibleRows = useMemo(() => {
        if (mode === 'transactions') {
            // Hide every revert AND every currently-reverted original.
            return rows.filter((r) => {
                const cs = chains.get(r.transactionId)!;
                if (cs.isRevert) return false;
                if (cs.isCurrentlyReverted) return false;
                return true;
            });
        }
        return groupForLedger(rows, chains);
    }, [rows, chains, mode]);

    const toggleAll = () => {
        if (selected.size === visibleRows.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(visibleRows.map((r) => r.transactionId)));
        }
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    function submitRevert(ids: string[]) {
        if (ids.length === 0) return;
        const fd = new FormData();
        fd.set('ids', ids.join(','));
        startTransition(async () => {
            try {
                await revertAction(fd);
            } catch (err) {
                console.error('[ledger] revert failed', err);
            }
        });
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Toolbar: selection actions left, mode toggle right */}
            <div className="flex flex-wrap items-center gap-2">
                {selected.size > 0 ? (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                                submitRevert(Array.from(selected))
                            }
                        >
                            Revert selected ({selected.size})
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(new Set())}
                        >
                            Clear
                        </Button>
                    </>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        Select rows to mass-revert
                    </span>
                )}
                <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
                    <Button
                        size="sm"
                        variant={mode === 'ledger' ? 'default' : 'ghost'}
                        onClick={() => setMode('ledger')}
                    >
                        Ledger
                    </Button>
                    <Button
                        size="sm"
                        variant={
                            mode === 'transactions' ? 'default' : 'ghost'
                        }
                        onClick={() => setMode('transactions')}
                    >
                        Transactions
                    </Button>
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                    <tr className="border-b">
                        {canRecord ? (
                            <th className="px-2 py-2 w-8">
                                <input
                                    type="checkbox"
                                    aria-label="Select all visible"
                                    checked={
                                        visibleRows.length > 0 &&
                                        selected.size === visibleRows.length
                                    }
                                    onChange={toggleAll}
                                />
                            </th>
                        ) : null}
                        <th className="px-2 py-2 text-left">Date</th>
                        <th className="px-2 py-2 text-left">Description</th>
                        <th className="px-2 py-2 text-left">Account</th>
                        <th className="px-2 py-2 text-left">Category</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-right">Amount</th>
                        {canRecord ? (
                            <th className="px-2 py-2 w-10"> </th>
                        ) : null}
                    </tr>
                </thead>
                <tbody>
                    {visibleRows.map((r) => {
                        const cs = chains.get(r.transactionId)!;
                        const isChild =
                            mode === 'ledger' &&
                            cs.chainRootId !== r.transactionId;
                        const sign =
                            r.transactionType === 'income' ? '+' : '−';
                        return (
                            <tr
                                key={r.transactionId}
                                className={
                                    'border-b last:border-b-0 ' +
                                    // Revert rows AND currently-reverted
                                    // originals both render struck-through
                                    // so the chain reads as a paired
                                    // cancellation at a glance.
                                    (cs.isCurrentlyReverted || cs.isRevert
                                        ? 'opacity-60 line-through decoration-muted-foreground/40'
                                        : '') +
                                    (cs.isRevert ? ' bg-muted/30' : '')
                                }
                            >
                                {canRecord ? (
                                    <td className="px-2 py-2">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(
                                                r.transactionId,
                                            )}
                                            onChange={() =>
                                                toggleOne(r.transactionId)
                                            }
                                            aria-label="Select"
                                        />
                                    </td>
                                ) : null}
                                <td className="px-2 py-2 font-mono text-xs">
                                    {isChild ? '↳ ' : ''}
                                    {r.occurredOn}
                                </td>
                                <td className="px-2 py-2">
                                    <Link
                                        href={`/tenants/${tenantId}/transactions/${r.transactionId}`}
                                        className="hover:underline"
                                    >
                                        {r.description ?? '—'}
                                    </Link>
                                    {cs.isRevert ? (
                                        <Badge
                                            variant="outline"
                                            className="ml-2 text-[10px]"
                                        >
                                            revert
                                        </Badge>
                                    ) : null}
                                    {cs.isCurrentlyReverted ? (
                                        <Badge
                                            variant="outline"
                                            className="ml-2 text-[10px]"
                                        >
                                            reverted
                                        </Badge>
                                    ) : null}
                                </td>
                                <td className="px-2 py-2">{r.accountName}</td>
                                <td className="px-2 py-2">
                                    {r.categoryName ?? '—'}
                                </td>
                                <td className="px-2 py-2">
                                    <Badge variant="outline">
                                        {r.transactionType}
                                    </Badge>
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums">
                                    {r.transactionType === 'transfer'
                                        ? formatMoney(r.amount, r.currency)
                                        : `${sign}${formatMoney(r.amount, r.currency)}`}
                                </td>
                                {canRecord ? (
                                    <td className="px-2 py-2">
                                        <RowMenu
                                            row={r}
                                            chainState={cs}
                                            onRevert={(targetIds) =>
                                                submitRevert(targetIds)
                                            }
                                            disabled={isPending}
                                        />
                                    </td>
                                ) : null}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function RowMenu({
    row,
    chainState,
    onRevert,
    disabled,
}: {
    row: LedgerRow;
    chainState: ChainState;
    onRevert: (ids: string[]) => void;
    disabled: boolean;
}) {
    // Three states:
    //   - Active original (chain root, not currently reverted)  → "Revert"
    //   - Reverted original (chain root, currently reverted)    → "Reapply"
    //   - Revert row (intermediate)                             → "Undo revert"
    // All three submit through the same `revertTransactionsAction` route;
    // only the target list differs.
    const isActive = !chainState.isRevert && !chainState.isCurrentlyReverted;
    const isReverted =
        !chainState.isRevert && chainState.isCurrentlyReverted;
    const isRevert = chainState.isRevert;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        aria-label="Row actions"
                        disabled={disabled}
                    >
                        <MoreHorizontalIcon className="size-4" />
                    </Button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-40">
                {isActive ? (
                    <DropdownMenuItem
                        onClick={() => onRevert([row.transactionId])}
                    >
                        Revert
                    </DropdownMenuItem>
                ) : null}
                {isReverted && chainState.revertedBy ? (
                    <DropdownMenuItem
                        onClick={() =>
                            onRevert([chainState.revertedBy as string])
                        }
                    >
                        Reapply
                    </DropdownMenuItem>
                ) : null}
                {isRevert ? (
                    <DropdownMenuItem
                        onClick={() => onRevert([row.transactionId])}
                    >
                        Undo revert
                    </DropdownMenuItem>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
