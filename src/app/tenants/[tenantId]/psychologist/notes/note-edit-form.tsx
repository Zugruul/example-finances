'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/submit-button';
import { Button } from '@/components/ui/button';
import {
    clearNoteDraft,
    readNoteDraft,
    writeNoteDraft,
} from '@/lib/note-drafts';

/**
 * Client-side note edit form with localStorage-backed drafts.
 *
 * - On mount: read any existing draft for (tenantId, draftKey); if
 *   present, use those values; otherwise fall back to the persisted
 *   title/body from the server-fetched note.
 * - On every input change: write the current values to the draft
 *   slot. Debounced via a 300ms timer so we don't thrash storage
 *   on every keystroke.
 * - On submit: defer to the parent server action (which redirects),
 *   then clear the draft slot — handled by the submit handler.
 * - "Discard draft" button explicitly clears the slot and resets
 *   the inputs to the persisted values.
 */
export function NoteEditForm({
    tenantId,
    noteId,
    initialTitle,
    initialBody,
    action,
}: {
    tenantId: string;
    noteId: string;
    initialTitle: string;
    initialBody: string;
    action: (formData: FormData) => Promise<void> | void;
}) {
    const draftKey = noteId;
    const [title, setTitle] = useState(initialTitle);
    const [body, setBody] = useState(initialBody);
    const [hasDraft, setHasDraft] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hydrate from draft on mount.
    useEffect(() => {
        const d = readNoteDraft(tenantId, draftKey);
        if (d) {
            setTitle(d.title);
            setBody(d.body);
            setHasDraft(true);
        }
    }, [tenantId, draftKey]);

    // Debounced auto-save on edits. Only writes when the user has
    // actually changed something from the persisted server values
    // (so opening the edit form alone doesn't create a draft).
    useEffect(() => {
        const dirty = title !== initialTitle || body !== initialBody;
        if (!dirty) {
            if (hasDraft) {
                clearNoteDraft(tenantId, draftKey);
                setHasDraft(false);
            }
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            writeNoteDraft(tenantId, draftKey, { title, body });
            setHasDraft(true);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [title, body, initialTitle, initialBody, tenantId, draftKey, hasDraft]);

    async function wrapped(formData: FormData) {
        formData.set('title', title);
        formData.set('body', body);
        // Clear the draft BEFORE handing over to the server action —
        // the action redirects on success, so clearing after wouldn't
        // run. If the action throws (validation), the form stays
        // mounted and the auto-save effect will re-create the draft
        // on the next keystroke.
        clearNoteDraft(tenantId, draftKey);
        await action(formData);
    }

    function discard() {
        setTitle(initialTitle);
        setBody(initialBody);
        clearNoteDraft(tenantId, draftKey);
        setHasDraft(false);
    }

    return (
        <form action={wrapped} className="mt-2 flex flex-col gap-2">
            {hasDraft ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    Unsaved draft restored from your last session.
                </div>
            ) : null}
            <Input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
            />
            <textarea
                name="body"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
                <SubmitButton size="sm" pendingLabel="Saving…">
                    Save changes
                </SubmitButton>
                {hasDraft ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={discard}
                    >
                        Discard draft
                    </Button>
                ) : null}
            </div>
        </form>
    );
}
