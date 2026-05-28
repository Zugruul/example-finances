/**
 * Per-tenant clinical-note draft persistence in localStorage.
 *
 * Drafts survive page navigation, hard reloads, and accidental
 * closes. Multiple drafts can be ongoing simultaneously — keyed
 * by noteId for existing-note edits and by `new:<clientId>` for
 * the new-note form so a user can be drafting against more than
 * one client without crossing wires.
 *
 * Stored under `notes-draft:<tenantId>:<key>`. Each entry holds
 * `{ title, body, updatedAt }`. The index of currently-drafted
 * keys is stored at `notes-draft-index:<tenantId>` so list views
 * can hydrate badges without scanning every storage key.
 *
 * NOTE: this is intentionally client-only (`typeof window` guard).
 * It is NOT a substitute for the server-side note aggregate; the
 * draft only matters until the user actually clicks Save, which
 * dispatches the server action and clears the draft.
 */

export type NoteDraft = {
    title: string;
    body: string;
    updatedAt: number; // epoch ms
};

const PREFIX = 'notes-draft';

function inBrowser(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
}

function entryKey(tenantId: string, key: string): string {
    return `${PREFIX}:${tenantId}:${key}`;
}

function indexKey(tenantId: string): string {
    return `${PREFIX}-index:${tenantId}`;
}

function readIndex(tenantId: string): string[] {
    if (!inBrowser()) return [];
    try {
        const raw = window.localStorage.getItem(indexKey(tenantId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((x) => typeof x === 'string')
            : [];
    } catch {
        return [];
    }
}

function writeIndex(tenantId: string, keys: string[]): void {
    if (!inBrowser()) return;
    try {
        if (keys.length === 0) {
            window.localStorage.removeItem(indexKey(tenantId));
        } else {
            window.localStorage.setItem(
                indexKey(tenantId),
                JSON.stringify(keys),
            );
        }
    } catch {
        // quota exceeded / disabled storage — fail silently
    }
}

export function readNoteDraft(
    tenantId: string,
    key: string,
): NoteDraft | null {
    if (!inBrowser()) return null;
    try {
        const raw = window.localStorage.getItem(entryKey(tenantId, key));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            typeof parsed?.title === 'string' &&
            typeof parsed?.body === 'string' &&
            typeof parsed?.updatedAt === 'number'
        ) {
            return parsed as NoteDraft;
        }
        return null;
    } catch {
        return null;
    }
}

export function writeNoteDraft(
    tenantId: string,
    key: string,
    draft: { title: string; body: string },
): void {
    if (!inBrowser()) return;
    try {
        const payload: NoteDraft = {
            title: draft.title,
            body: draft.body,
            updatedAt: Date.now(),
        };
        window.localStorage.setItem(
            entryKey(tenantId, key),
            JSON.stringify(payload),
        );
        const idx = readIndex(tenantId);
        if (!idx.includes(key)) writeIndex(tenantId, [...idx, key]);
        // Fire a storage-style event so sibling components on the
        // same page (e.g. the drafts banner + the per-row badge) can
        // re-read without polling. `storage` events don't fire in the
        // tab that wrote, so we synthesize one.
        window.dispatchEvent(
            new CustomEvent('notes-draft-changed', {
                detail: { tenantId, key },
            }),
        );
    } catch {
        // ignore
    }
}

export function clearNoteDraft(tenantId: string, key: string): void {
    if (!inBrowser()) return;
    try {
        window.localStorage.removeItem(entryKey(tenantId, key));
        const idx = readIndex(tenantId).filter((k) => k !== key);
        writeIndex(tenantId, idx);
        window.dispatchEvent(
            new CustomEvent('notes-draft-changed', {
                detail: { tenantId, key },
            }),
        );
    } catch {
        // ignore
    }
}

export function listNoteDraftKeys(tenantId: string): string[] {
    return readIndex(tenantId);
}

/** Draft slot key for the new-note form, per-client. */
export function newNoteDraftKey(clientId: string): string {
    return `new:${clientId}`;
}

/** Is this key a new-note draft, and if so for which client? */
export function parseNewNoteDraftKey(key: string): string | null {
    return key.startsWith('new:') ? key.slice(4) : null;
}
