import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { ScrollTextIcon } from 'lucide-react';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { Button } from '@/components/ui/button';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { fetchAuditPage } from '@/lib/audit-query';
import {
    auditViewLinks,
    formatAuditEvent,
    type AuditCtx,
} from '@/lib/audit-format';

export const dynamic = 'force-dynamic';

/**
 * Top-level cross-tenant audit log. Surfaces every audit-relevant
 * event across every tenant the signed-in user belongs to, newest
 * first. Complements the per-tenant `/tenants/[id]/audit` page —
 * useful for users with multiple tenants who want a single feed.
 *
 * Trade-offs vs the per-tenant view:
 *   - No SSE live tail (single-tenant change stream doesn't fan out
 *     cleanly). Click "Refresh" to pull newer entries. The per-tenant
 *     page is still the place to go for real-time monitoring.
 *   - No domain filter chips — the dataset is already a union; the
 *     existing per-tenant tabs are the right UI for scoping.
 *   - Each card shows which tenant the event belongs to.
 */
export default async function CrossTenantAuditPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const memberships = (
        await readModels.memberships.find({ userId: session.user.id })
    ).filter((m) => !m.removedAt);
    const tenantIds = memberships.map((m) => String(m.tenantId));

    if (tenantIds.length === 0) {
        return (
            <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
                <BreadcrumbBar items={[{ label: 'Audit' }]} />
                <h1 className="text-2xl font-semibold tracking-tight">
                    Audit log
                </h1>
                <EmptyState
                    icon={<ScrollTextIcon />}
                    title="No tenants yet"
                    description="Create or join a workspace to start an audit trail."
                />
            </main>
        );
    }

    const [page, accounts, categories, allUsers, tenantDocs] = await Promise.all([
        fetchAuditPage({ tenantIds, limit: 100 }),
        Promise.all(
            tenantIds.map((tid) => readModels.accountsByTenant.find({ tenantId: tid })),
        ).then((rs) => rs.flat()),
        Promise.all(
            tenantIds.map((tid) => readModels.categoriesByTenant.find({ tenantId: tid })),
        ).then((rs) => rs.flat()),
        readModels.usersById.find({}),
        Promise.all(
            tenantIds.map((tid) => readModels.tenants.find({ tenantId: tid })),
        ).then((rs) => rs.flat()),
    ]);

    const ctx: AuditCtx = {
        accounts: new Map(
            accounts.map((a) => [
                String(a.accountId),
                { displayName: a.name, currency: a.currency },
            ]),
        ),
        categories: new Map(
            categories.map((c) => [
                String(c.categoryId),
                { displayName: c.name },
            ]),
        ),
        users: new Map(
            allUsers
                .filter((u) => u.email)
                .map((u) => [String(u.userId), { email: u.email as string }]),
        ),
    };
    const tenantNameById = new Map(
        tenantDocs.map((t) => [String(t.tenantId), t.displayName]),
    );

    const cards = page.events.map((ev) => {
        const card = formatAuditEvent(ev, ctx);
        // Derive the owning tenantId for the badge — prefer payload's
        // tenantId; fall back to parsing `tenant-<id>` from the stream.
        let tid = String((ev.payload as any).tenantId ?? '');
        if (!tid && ev.stream.startsWith('tenant-')) {
            const parts = ev.stream.split('-');
            tid = parts[1] ?? '';
            // Membership streams look like `tenant-<tid>-membership-<mid>`
            // → the second segment is the tenant.
        }
        return {
            ...card,
            tenantId: tid,
            tenantName: tenantNameById.get(tid) ?? undefined,
        };
    });

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar items={[{ label: 'Audit' }]} />
            <header className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Audit log
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Every action across the{' '}
                        {tenantIds.length === 1
                            ? 'workspace you belong to'
                            : `${tenantIds.length} workspaces you belong to`}
                        , newest first. Per-tenant view is at{' '}
                        <Link
                            href={`/tenants/${tenantIds[0]}/audit`}
                            className="text-sky-600 hover:underline dark:text-sky-400"
                        >
                            /tenants/[id]/audit
                        </Link>{' '}
                        (live).
                    </p>
                </div>
                <form>
                    <Button type="submit" variant="outline" size="sm">
                        Refresh
                    </Button>
                </form>
            </header>

            {cards.length === 0 ? (
                <EmptyState
                    icon={<ScrollTextIcon />}
                    title="No activity yet"
                    description="Actions across your workspaces will show up here."
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {cards.map((c) => (
                        <li key={c.uuid}>
                            <AuditCardView card={c} />
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}

function AuditCardView({
    card,
}: {
    card: ReturnType<typeof formatAuditEvent> & {
        tenantId?: string;
        tenantName?: string;
    };
}) {
    const links = card.tenantId
        ? auditViewLinks(card, card.tenantId)
        : null;
    return (
        <Card>
            <CardContent className="flex flex-col gap-1.5 p-3">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">
                        {card.title}
                    </p>
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
                    {card.tenantName ? (
                        <Badge variant="outline" className="text-[10px]">
                            {card.tenantName}
                        </Badge>
                    ) : null}
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
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}
