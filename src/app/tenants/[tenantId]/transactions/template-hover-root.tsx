'use client';

import { useEffect, useRef } from 'react';

/**
 * Wrap the QuickPick + Ledger together with this. Any descendant element
 * carrying `data-template-id="<id>"` participates in a cross-highlight:
 * hovering one element adds a `data-template-active="true"` attribute to
 * every other element sharing the same id (including the hovered one).
 *
 * Plain DOM + event delegation rather than React state because:
 * - the ledger is already a client component and re-mounting it on every
 *   hover would be wasteful;
 * - quick-pick cards are server-rendered <Link>s (no React state surface);
 * - keeps the contract on a simple attribute the consumers already need
 *   for accessibility (the id) — no extra wiring.
 *
 * The styling itself lives in `globals.css` via the
 * `data-[template-active=true]:` Tailwind selector.
 */
export function TemplateHoverRoot({
    children,
}: {
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = ref.current;
        if (!root) return;

        function setActive(id: string | null) {
            // Clear previous highlights first so a fast-moving cursor
            // never leaves stale ones around.
            root!
                .querySelectorAll<HTMLElement>(
                    '[data-template-active="true"]',
                )
                .forEach((el) => {
                    el.removeAttribute('data-template-active');
                });
            if (!id) return;
            root!
                .querySelectorAll<HTMLElement>(
                    `[data-template-id="${cssEscape(id)}"]`,
                )
                .forEach((el) => {
                    el.setAttribute('data-template-active', 'true');
                });
        }

        function onOver(e: Event) {
            const t = (e.target as HTMLElement | null)?.closest?.(
                '[data-template-id]',
            );
            const id = (t as HTMLElement | null)?.getAttribute(
                'data-template-id',
            );
            setActive(id || null);
        }
        function onOut(e: Event) {
            // mouseout fires when entering a child too — only clear
            // when we're leaving the entire root subtree of the hovered
            // template-id element.
            const t = (e.target as HTMLElement | null)?.closest?.(
                '[data-template-id]',
            );
            const related = (e as MouseEvent).relatedTarget as
                | HTMLElement
                | null;
            const stillInsideSame =
                related &&
                related.closest?.('[data-template-id]') === t;
            if (!stillInsideSame) setActive(null);
        }

        root.addEventListener('mouseover', onOver);
        root.addEventListener('mouseout', onOut);
        return () => {
            root.removeEventListener('mouseover', onOver);
            root.removeEventListener('mouseout', onOut);
        };
    }, []);

    return <div ref={ref}>{children}</div>;
}

/**
 * Escape a value for embedding inside a CSS attribute selector. Modern
 * browsers expose `CSS.escape` but we polyfill defensively for SSR /
 * very old runtimes.
 */
function cssEscape(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    return value.replace(/["\\]/g, '\\$&');
}
