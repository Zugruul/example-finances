'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { ScrollTextIcon } from 'lucide-react';
import {
    AUDIT_DOMAINS,
    auditViewLinks,
    formatAuditEvent,
    type AuditCard,
    type AuditCtx,
    type AuditDomain,
} from '@/lib/audit-format';
import type { PagedCursor, RawEvent } from '@/lib/audit-query';

interface AuditStreamProps {
    tenantId: string;
    initialCards: AuditCard[];
    initialNextOlder: PagedCursor | null;
    accountOptions: { id: string; displayName: string }[];
    ctxSerialized: {
        accounts: [string, { displayName: string; currency: string }][];
        categories: [string, { displayName: string }][];
        users: [string, { email: string }][];
    };
    /** Page title + description rendered alongside the live badge. */
    title: string;
    description: string;
}

type DomainFilter = AuditDomain | 'all';

export function AuditStream({
    tenantId,
    initialCards,
    initialNextOlder,
    accountOptions,
    ctxSerialized,
    title,
    description,
}: AuditStreamProps) {
    // Reconstruct the formatter context client-side so SSE arrivals get
    // the same human labels as the server-rendered first page.
    const ctx = useMemo<AuditCtx>(
        () => ({
            accounts: new Map(ctxSerialized.accounts),
            categories: new Map(ctxSerialized.categories),
            users: new Map(ctxSerialized.users),
        }),
        [ctxSerialized],
    );

    const [cards, setCards] = useState<AuditCard[]>(initialCards);
    const [olderCursor, setOlderCursor] = useState<PagedCursor | null>(
        initialNextOlder,
    );
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');
    const [streamStatus, setStreamStatus] = useState<
        'live' | 'connecting' | 'offline'
    >('connecting');

    // Track the newest cursor we've successfully observed; used as the
    // SSE resume hint when (re)connecting.
    const newestRef = useRef<PagedCursor | null>(
        initialCards.length > 0
            ? {
                  publishedAt: initialCards[0]!.publishedAt,
                  uuid: initialCards[0]!.uuid,
              }
            : null,
    );

    // Seen uuids (dedupe across SSE replay + initial server render).
    const seenRef = useRef<Set<string>>(
        new Set(initialCards.map((c) => c.uuid)),
    );

    // Scroll-anchor preservation for prepend. When a new card appears at
    // the top while the user has scrolled past it, we measure the height
    // delta after render and apply it to scrollTop so the viewport never
    // jumps. The list container is the scrollable element.
    const containerRef = useRef<HTMLDivElement | null>(null);

    // --- prepend handler with scroll-anchor preservation -----------------
    const prependCards = useCallback((incoming: AuditCard[]) => {
        if (incoming.length === 0) return;
        // De-dupe vs. anything already in state.
        const fresh = incoming.filter((c) => !seenRef.current.has(c.uuid));
        if (fresh.length === 0) return;
        for (const c of fresh) seenRef.current.add(c.uuid);

        // Measure BEFORE the mutation. We use the page's scrolling
        // element (window) since the cards live inline in <main>; if a
        // dedicated scroll container is later added, swap to that ref.
        const scrollEl = document.scrollingElement ?? document.documentElement;
        const prevTop = scrollEl.scrollTop;
        const prevHeight = scrollEl.scrollHeight;
        const isAtTop = prevTop < 4;

        setCards((prev) => {
            // Newest events are emitted oldest→newest by the SSE replay;
            // we want NEWEST first in the visual list. So we prepend each
            // in arrival order: a card delivered later is newer and lands
            // ABOVE earlier ones. Build the new array as [reversedFresh,
            // ...prev] so the freshest sits at index 0.
            const reversed = [...fresh].reverse();
            const next = [...reversed, ...prev];
            // Update the "newest cursor" to the absolute newest card now
            // in state (used for next SSE reconnect resume).
            const top = next[0];
            if (top) {
                newestRef.current = {
                    publishedAt: top.publishedAt,
                    uuid: top.uuid,
                };
            }
            return next;
        });

        // After paint, if the user was NOT at the very top, restore their
        // visual anchor by adding (newHeight - prevHeight) to scrollTop.
        requestAnimationFrame(() => {
            if (isAtTop) return;
            const newHeight = scrollEl.scrollHeight;
            const delta = newHeight - prevHeight;
            if (delta !== 0) scrollEl.scrollTop = prevTop + delta;
        });
    }, []);

    // --- SSE subscription with auto-reconnect via EventSource ------------
    useEffect(() => {
        const since = newestRef.current;
        const params = new URLSearchParams();
        if (since) {
            params.set('sincePa', since.publishedAt);
            params.set('sinceUuid', since.uuid);
        }
        const url = `/api/tenants/${tenantId}/audit/stream${
            params.toString() ? `?${params.toString()}` : ''
        }`;
        setStreamStatus('connecting');
        const es = new EventSource(url);
        es.onopen = () => setStreamStatus('live');
        es.onerror = () => {
            // EventSource will auto-reconnect; flip to 'offline' to
            // surface that fact in the chip. On the next 'open' we'll
            // flip back to 'live'. Note: the browser sends Last-Event-ID
            // automatically, so the server's backfill picks up where we
            // left off — no client work required for the missed window.
            setStreamStatus('offline');
        };
        es.onmessage = (e) => {
            try {
                const raw = JSON.parse(e.data) as RawEvent;
                const card = formatAuditEvent(raw, ctx);
                prependCards([card]);
            } catch (err) {
                console.warn('[audit] bad SSE frame', err);
            }
        };
        return () => {
            es.close();
        };
    }, [tenantId, ctx, prependCards]);

    // --- infinite scroll: load older when sentinel enters the viewport ---
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const loadOlder = useCallback(async () => {
        if (loadingOlder || !olderCursor) return;
        setLoadingOlder(true);
        try {
            const url = new URL(
                `/api/tenants/${tenantId}/audit/page`,
                window.location.origin,
            );
            url.searchParams.set('olderPa', olderCursor.publishedAt);
            url.searchParams.set('olderUuid', olderCursor.uuid);
            url.searchParams.set('limit', '50');
            const res = await fetch(url.toString(), {
                credentials: 'same-origin',
            });
            if (!res.ok) {
                throw new Error(`page fetch ${res.status}`);
            }
            const body = (await res.json()) as {
                events: RawEvent[];
                nextOlder: PagedCursor | null;
            };
            const older = body.events
                .map((ev) => formatAuditEvent(ev, ctx))
                .filter((c) => !seenRef.current.has(c.uuid));
            for (const c of older) seenRef.current.add(c.uuid);
            // Server returns newest-first within the page; append at the
            // BOTTOM (these are older than everything currently in view).
            setCards((prev) => [...prev, ...older]);
            setOlderCursor(body.nextOlder);
        } catch (err) {
            console.warn('[audit] loadOlder failed', err);
        } finally {
            setLoadingOlder(false);
        }
    }, [olderCursor, loadingOlder, tenantId, ctx]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        // rootMargin keeps a 50-card buffer ahead of the user — by the
        // time they scroll into view, the next page is already loaded.
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        void loadOlder();
                    }
                }
            },
            { rootMargin: '600px 0px 600px 0px' },
        );
        io.observe(sentinel);
        return () => io.disconnect();
    }, [loadOlder]);

    // --- filter pass ----------------------------------------------------
    const visible = useMemo(() => {
        return cards.filter((c) => {
            if (domainFilter !== 'all' && c.domain !== domainFilter) return false;
            if (
                accountFilter !== 'all' &&
                (c.accountId ?? '') !== accountFilter
            ) {
                return false;
            }
            return true;
        });
    }, [cards, domainFilter, accountFilter]);

    return (
        <div ref={containerRef} className="flex flex-col gap-4">
            {/* Header — title on the left, live status on the right */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {title}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                <Badge
                    variant="outline"
                    className={
                        'shrink-0 ' +
                        (streamStatus === 'live'
                            ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : streamStatus === 'offline'
                              ? 'border-amber-500 text-amber-700 dark:text-amber-300'
                              : '')
                    }
                >
                    {streamStatus === 'live'
                        ? '● live'
                        : streamStatus === 'offline'
                          ? '○ reconnecting'
                          : '○ connecting'}
                </Badge>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                    {AUDIT_DOMAINS.map((d) => {
                        const active = domainFilter === d.value;
                        return (
                            <Button
                                key={d.value}
                                size="sm"
                                variant={active ? 'default' : 'outline'}
                                onClick={() => setDomainFilter(d.value)}
                            >
                                {d.label}
                            </Button>
                        );
                    })}
                </div>
                <div className="ml-auto">
                    <select
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value)}
                        aria-label="Filter by account"
                    >
                        <option value="all">All accounts</option>
                        {accountOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.displayName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Cards */}
            {visible.length === 0 ? (
                <EmptyState
                    icon={<ScrollTextIcon />}
                    title="No matching actions"
                    description="Adjust the filters or wait for new activity."
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {visible.map((c) => (
                        <li key={c.uuid}>
                            <AuditCardView card={c} tenantId={tenantId} />
                        </li>
                    ))}
                </ul>
            )}

            {/* Sentinel for infinite scroll */}
            {olderCursor ? (
                <div ref={sentinelRef} className="py-4 text-center text-xs text-muted-foreground">
                    {loadingOlder ? 'Loading older…' : 'Scroll for more'}
                </div>
            ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">
                    End of history
                </div>
            )}
        </div>
    );
}

function AuditCardView({
    card,
    tenantId,
}: {
    card: AuditCard;
    tenantId: string;
}) {
    const links = auditViewLinks(card, tenantId);
    return (
        <Card>
            <CardContent className="flex flex-col gap-1.5 p-3">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">
                        {card.title}
                    </p>
                    {/* Server runs in UTC; client in the user's tz.
                        Server's text is best-effort and will be replaced
                        on hydration — suppress the mismatch warning. */}
                    <span
                        suppressHydrationWarning
                        className="shrink-0 text-xs text-muted-foreground"
                    >
                        {formatLocalTime(card.publishedAt)}
                    </span>
                </div>
                {card.detail ? (
                    <p className="text-xs text-muted-foreground">
                        {card.detail}
                    </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                        {card.domain}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                        {card.name}
                    </Badge>
                    {card.actorEmail ? (
                        <span title={card.actorEmail}>
                            by {card.actorEmail}
                        </span>
                    ) : null}
                    {links ? (
                        <span className="ml-auto flex items-center gap-2">
                            {links.view ? (
                                <a
                                    href={links.view}
                                    className="text-sky-600 hover:underline dark:text-sky-400"
                                >
                                    View
                                </a>
                            ) : null}
                            <a
                                href={links.viewIn}
                                className="text-sky-600 hover:underline dark:text-sky-400"
                            >
                                {links.viewInLabel}
                            </a>
                        </span>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function formatLocalTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return iso;
    }
}
