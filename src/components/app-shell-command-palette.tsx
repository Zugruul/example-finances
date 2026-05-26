'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { TenantOption } from '@/components/app-shell-tenant-selector';

/**
 * ⌘K / Ctrl+K command palette. Global tenant switcher mounted in the
 * app shell. Keyboard:
 *   - Cmd/Ctrl+K        — toggle open
 *   - Esc               — close (handled by base-ui Dialog)
 *   - ArrowUp/ArrowDown — move selection
 *   - Enter             — navigate to selected tenant
 *
 * Filters tenants by case-insensitive substring match on displayName.
 * Server-shipped tenant list (props) — no client fetch.
 */
export function AppShellCommandPalette({
    tenants,
}: {
    tenants: TenantOption[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [rawSelectedIdx, setRawSelectedIdx] = useState(0);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return tenants;
        return tenants.filter((t) => t.displayName.toLowerCase().includes(q));
    }, [tenants, query]);

    // Clamp the selection to the filtered list at render time so an
    // earlier large index doesn't point past the new end after typing.
    // No effect needed: the clamp is a pure derivation.
    const selectedIdx =
        filtered.length === 0
            ? 0
            : Math.min(rawSelectedIdx, filtered.length - 1);

    // Cmd/Ctrl+K toggle. Use a single global listener instead of a
    // hidden button-trigger so the binding works from anywhere.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    function handleOpenChange(next: boolean) {
        setOpen(next);
        // Reset both query and selection synchronously with the close so
        // the next open starts fresh — no effect, no cascading render.
        if (!next) {
            setQuery('');
            setRawSelectedIdx(0);
        }
    }

    function navigateTo(tenantId: string) {
        handleOpenChange(false);
        router.push(`/tenants/${tenantId}`);
    }

    function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setRawSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setRawSelectedIdx((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
            const chosen = filtered[selectedIdx];
            if (chosen) navigateTo(chosen.tenantId);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="top-[20%] max-w-md p-0"
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">Switch tenant</DialogTitle>
                <DialogDescription className="sr-only">
                    Type to search across your tenants. Use arrow keys to
                    navigate; Enter to switch.
                </DialogDescription>
                <div className="flex items-center gap-2 border-b px-3 py-2">
                    <SearchIcon className="size-4 text-muted-foreground" />
                    <Input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onInputKeyDown}
                        placeholder="Switch tenant…"
                        className="border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                </div>
                <ul className="max-h-80 overflow-y-auto p-1">
                    {filtered.length === 0 ? (
                        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                            No tenants match “{query}”.
                        </li>
                    ) : (
                        filtered.map((t, i) => (
                            <li key={t.tenantId}>
                                <button
                                    type="button"
                                    onClick={() => navigateTo(t.tenantId)}
                                    onMouseEnter={() => setRawSelectedIdx(i)}
                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                                        i === selectedIdx
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-accent/50'
                                    }`}
                                >
                                    <span
                                        className="truncate"
                                        title={t.displayName}
                                    >
                                        {t.displayName}
                                    </span>
                                    <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                                        {t.tenantId.slice(0, 8)}
                                    </span>
                                </button>
                            </li>
                        ))
                    )}
                </ul>
                <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span>
                        <kbd className="rounded border bg-background px-1 font-sans">
                            ↑↓
                        </kbd>{' '}
                        navigate{' '}
                        <kbd className="ml-2 rounded border bg-background px-1 font-sans">
                            ↵
                        </kbd>{' '}
                        select
                    </span>
                    <span>
                        <kbd className="rounded border bg-background px-1 font-sans">
                            esc
                        </kbd>{' '}
                        close
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
