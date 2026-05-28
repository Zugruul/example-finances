'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listNoteDraftKeys, parseNewNoteDraftKey } from '@/lib/note-drafts';

/**
 * Top-of-page banner listing every in-progress draft. Hydrates from
 * localStorage on mount and re-reads when any other component on the
 * page fires the `notes-draft-changed` event (the helper synthesizes
 * it on every write/clear since `storage` events don't fire in the
 * same tab).
 */
export function DraftsBanner({
    tenantId,
    clientNames,
    noteTitles,
}: {
    tenantId: string;
    clientNames: Record<string, string>;
    noteTitles: Record<string, string>;
}) {
    const [keys, setKeys] = useState<string[]>([]);

    useEffect(() => {
        function refresh() {
            setKeys(listNoteDraftKeys(tenantId));
        }
        refresh();
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent).detail as
                | { tenantId?: string }
                | undefined;
            if (!detail || detail.tenantId === tenantId) refresh();
        };
        const onStorage = (e: StorageEvent) => {
            if (e.key && e.key.includes(tenantId)) refresh();
        };
        window.addEventListener('notes-draft-changed', onChange);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener('notes-draft-changed', onChange);
            window.removeEventListener('storage', onStorage);
        };
    }, [tenantId]);

    if (keys.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">
                You have {keys.length} unsaved note{' '}
                {keys.length === 1 ? 'draft' : 'drafts'}
            </p>
            <ul className="flex flex-col gap-1 text-xs">
                {keys.map((k) => {
                    const newClientId = parseNewNoteDraftKey(k);
                    if (newClientId) {
                        const cn = clientNames[newClientId] ?? newClientId;
                        return (
                            <li key={k}>
                                New note for <span className="font-medium">{cn}</span>{' '}
                                — scroll to "New note" below to resume.
                            </li>
                        );
                    }
                    const title = noteTitles[k] ?? '(unknown note)';
                    return (
                        <li key={k}>
                            <Link
                                href={`/tenants/${tenantId}/psychologist/notes?edit=${k}#note-${k}`}
                                className="text-sky-700 hover:underline dark:text-sky-300"
                            >
                                Resume editing: {title}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
