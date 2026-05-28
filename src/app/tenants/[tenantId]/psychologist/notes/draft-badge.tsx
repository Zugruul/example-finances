'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { listNoteDraftKeys } from '@/lib/note-drafts';

/**
 * Tiny client-side flag that renders an amber "unsaved" badge when
 * a draft exists for the given noteId. Subscribes to the
 * `notes-draft-changed` synthetic event so the badge appears /
 * disappears in real time as the user types in another row's
 * edit form on the same page.
 */
export function DraftBadge({
    tenantId,
    noteId,
}: {
    tenantId: string;
    noteId: string;
}) {
    const [present, setPresent] = useState(false);

    useEffect(() => {
        function refresh() {
            setPresent(listNoteDraftKeys(tenantId).includes(noteId));
        }
        refresh();
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent).detail as
                | { tenantId?: string; key?: string }
                | undefined;
            if (
                !detail ||
                detail.tenantId === tenantId ||
                detail.key === noteId
            ) {
                refresh();
            }
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
    }, [tenantId, noteId]);

    if (!present) return null;
    return (
        <Badge
            variant="outline"
            className="text-[10px] border-amber-500/60 text-amber-700 dark:text-amber-300"
        >
            unsaved
        </Badge>
    );
}
