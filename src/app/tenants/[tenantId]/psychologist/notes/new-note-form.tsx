'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { Button } from '@/components/ui/button';
import {
    clearNoteDraft,
    newNoteDraftKey,
    readNoteDraft,
    writeNoteDraft,
} from '@/lib/note-drafts';

/**
 * New-note form with per-client localStorage drafts.
 *
 * The draft slot key is `new:<clientId>`, so a user can keep
 * one in-progress draft open against each client without crossing
 * them. Selecting a different client swaps the visible draft.
 */
type ClientOption = {
    clientId: string;
    label: string;
};

type SessionOption = {
    sessionId: string;
    label: string;
    clientId: string;
};

export function NewNoteForm({
    tenantId,
    clients,
    sessions,
    action,
}: {
    tenantId: string;
    clients: ClientOption[];
    sessions: SessionOption[];
    action: (formData: FormData) => Promise<void> | void;
}) {
    const [clientId, setClientId] = useState(clients[0]?.clientId ?? '');
    const [sessionId, setSessionId] = useState('');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [hasDraft, setHasDraft] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftKey = clientId ? newNoteDraftKey(clientId) : null;

    // When the client picker changes, swap to that client's draft.
    useEffect(() => {
        if (!draftKey) {
            setTitle('');
            setBody('');
            setHasDraft(false);
            return;
        }
        const d = readNoteDraft(tenantId, draftKey);
        if (d) {
            setTitle(d.title);
            setBody(d.body);
            setHasDraft(true);
        } else {
            setTitle('');
            setBody('');
            setHasDraft(false);
        }
    }, [tenantId, draftKey]);

    // Debounced auto-save while there's any content.
    useEffect(() => {
        if (!draftKey) return;
        const dirty = title.length > 0 || body.length > 0;
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
    }, [title, body, tenantId, draftKey, hasDraft]);

    async function wrapped(formData: FormData) {
        formData.set('clientId', clientId);
        formData.set('sessionId', sessionId);
        formData.set('title', title);
        formData.set('body', body);
        if (draftKey) clearNoteDraft(tenantId, draftKey);
        await action(formData);
    }

    function discard() {
        if (!draftKey) return;
        setTitle('');
        setBody('');
        clearNoteDraft(tenantId, draftKey);
        setHasDraft(false);
    }

    const filteredSessions = clientId
        ? sessions.filter((s) => s.clientId === clientId)
        : sessions;

    return (
        <form action={wrapped} className="grid gap-3 sm:grid-cols-2">
            {hasDraft ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-900 sm:col-span-2 dark:bg-amber-900/20 dark:text-amber-200">
                    Unsaved draft restored for this client.
                </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="clientId">Client</Label>
                <select
                    id="clientId"
                    name="clientId"
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    {clients.map((c) => (
                        <option key={c.clientId} value={c.clientId}>
                            {c.label}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="sessionId">Session (optional)</Label>
                <select
                    id="sessionId"
                    name="sessionId"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    <option value="">(none)</option>
                    {filteredSessions.map((s) => (
                        <option key={s.sessionId} value={s.sessionId}>
                            {s.label}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                    id="title"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={200}
                />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="body">Body</Label>
                <textarea
                    id="body"
                    name="body"
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                />
            </div>
            <div className="flex gap-2 sm:col-span-2">
                <SubmitButton pendingLabel="Saving…">Save note</SubmitButton>
                {hasDraft ? (
                    <Button
                        type="button"
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
