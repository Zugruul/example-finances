import { readModels } from '@/sorc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { CopyIdButton } from '@/components/copy-id-button';
import { ScrollTextIcon } from 'lucide-react';
import type { SorcUUID } from '@event-sorcerer/core';

/** Truncate an id for inline display. Full value is available via the copy button. */
function shortId(id: string): string {
    if (id.length <= 12) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/**
 * Identity label: email if known, the short id otherwise. Used inside the
 * human-readable summary line. The "CLI bootstrap" sentinel renders as that
 * label literally (the value is the string `'cli-bootstrap'` rather than a
 * SorcUUID).
 */
function identity(
    id: string | undefined,
    emailMap: Map<string, string>,
): string {
    if (!id) return 'unknown';
    if (id === 'cli-bootstrap') return 'CLI bootstrap';
    if (id === 'system') return 'system';
    const email = emailMap.get(id);
    if (email) return email;
    return shortId(id);
}

type ActivityRow = Awaited<ReturnType<typeof readModels.adminActivity.find>>[number];

function summarize(a: ActivityRow, emailMap: Map<string, string>): string {
    const actor = identity(a.actorAdminId, emailMap);
    const target = identity(a.targetUserId, emailMap);
    switch (a.kind) {
        case 'ImpersonationStarted':
            return `${actor} started impersonating ${
                a.targetEmail ?? target
            }`;
        case 'ImpersonationEnded':
            return `${actor} ended impersonation (reason: ${a.reason ?? 'user'})`;
        case 'AdminGranted':
            if (a.actorAdminId === a.targetUserId) {
                return `${target} was self-granted platform admin`;
            }
            return `${actor} granted platform admin to ${target}`;
        case 'AdminRemoved':
            return `${actor} removed platform admin from ${target}`;
        case 'AdminActionTaken':
            return `${actor} performed ${a.action ?? 'admin action'}${
                a.note ? ` — ${a.note}` : ''
            }`;
        default:
            return `${actor} performed ${(a as { kind: string }).kind}`;
    }
}

export default async function AdminAuditLogPage() {
    const activity = (await readModels.adminActivity.find({})).sort(
        (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    // Batched email lookup: collect every userId referenced across the rows,
    // resolve to email in one read-model query.
    const uniqueIds = new Set<string>();
    for (const a of activity) {
        if (a.actorAdminId && a.actorAdminId !== 'cli-bootstrap' && a.actorAdminId !== 'system') {
            uniqueIds.add(a.actorAdminId);
        }
        if (a.targetUserId) uniqueIds.add(a.targetUserId);
    }
    const emailMap = new Map<string, string>();
    if (uniqueIds.size > 0) {
        const users = await readModels.usersById.find({});
        for (const u of users) {
            if (u.email && uniqueIds.has(u.userId)) {
                emailMap.set(u.userId, u.email);
            }
        }
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Admin', href: '/admin' },
                    { label: 'Audit log' },
                ]}
            />
            <h1 className="text-2xl font-semibold tracking-tight">
                Admin audit log
            </h1>

            <Card>
                <CardHeader>
                    <CardTitle>{activity.length} event(s)</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {activity.length === 0 ? (
                        <EmptyState
                            icon={<ScrollTextIcon />}
                            title="No admin actions yet"
                            description="Grants, impersonations, and other admin events will show up here once recorded."
                        />
                    ) : (
                        activity.map((a) => (
                            <div
                                key={a.eventId}
                                className="flex flex-col gap-2 rounded-md border p-3"
                            >
                                {/* Human-readable summary */}
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-medium leading-snug">
                                        {summarize(a, emailMap)}
                                    </p>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {new Date(
                                            a.occurredAt,
                                        ).toLocaleString()}
                                    </span>
                                </div>
                                {/* Technical detail row */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-0 text-xs text-muted-foreground">
                                    <Badge
                                        variant="outline"
                                        className="text-[10px]"
                                    >
                                        {a.kind}
                                    </Badge>
                                    {a.kind === 'ImpersonationEnded' &&
                                    a.reason === 'expired' ? (
                                        <Badge
                                            variant="outline"
                                            className="border-amber-500 text-[10px] text-amber-700 dark:text-amber-300"
                                        >
                                            expired
                                        </Badge>
                                    ) : null}
                                    <IdField
                                        label="event"
                                        value={a.eventId}
                                    />
                                    <IdField
                                        label="actor"
                                        value={a.actorAdminId}
                                    />
                                    {a.targetUserId ? (
                                        <IdField
                                            label="target"
                                            value={a.targetUserId}
                                        />
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

function IdField({ label, value }: { label: string; value: string | SorcUUID }) {
    return (
        <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground/70">{label}:</span>
            <code className="font-mono text-[11px]">{shortId(String(value))}</code>
            <CopyIdButton value={String(value)} label={label} />
        </span>
    );
}
