'use client';

import { CopyIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Inline icon-only button that copies an id (or any short string) to the
 * clipboard. Briefly swaps the icon to a check on success. Uses sonner
 * for a toast confirmation. Designed to sit immediately to the right of
 * the value it copies.
 */
export function CopyIdButton({
    value,
    label,
}: {
    value: string;
    label?: string;
}) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success(`${label ?? 'ID'} copied`);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            toast.error('Copy failed');
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${label ?? 'ID'} to clipboard`}
            className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-1 focus-visible:outline-ring"
        >
            {copied ? (
                <CheckIcon className="size-3.5" />
            ) : (
                <CopyIcon className="size-3.5" />
            )}
        </button>
    );
}
