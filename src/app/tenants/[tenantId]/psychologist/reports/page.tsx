import { notFound } from 'next/navigation';
import { readModels } from '@/sorc';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';

type Params = { tenantId: string };

export const dynamic = 'force-dynamic';

function monthKey(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
        2,
        '0',
    )}`;
}

export default async function PsychologistReportsPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId } = await props.params;
    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const [clients, sessions] = await Promise.all([
        readModels.psychologistClients.find({ tenantId }),
        readModels.psychologistSessions.find({ tenantId }),
    ]);
    const activeClients = clients.filter((c) => !c.isArchived);
    const clientById = new Map(
        clients.map((c) => [String(c.clientId), c]),
    );

    // Per-month aggregate over the last 6 months. Includes scheduled
    // (future) so the chart shows pipeline alongside completed.
    const now = new Date();
    const months: Array<{ key: string; label: string }> = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
        );
        months.push({
            key: monthKey(d),
            label: d.toLocaleString(undefined, {
                month: 'short',
                year: '2-digit',
                timeZone: 'UTC',
            }),
        });
    }
    const monthStats = months.map(({ key, label }) => {
        const inMonth = sessions.filter(
            (s) => monthKey(new Date(s.startsAt)) === key,
        );
        return {
            label,
            scheduled: inMonth.filter((s) => s.status === 'scheduled').length,
            completed: inMonth.filter((s) => s.status === 'completed').length,
            cancelled: inMonth.filter((s) => s.status === 'cancelled').length,
            noShow: inMonth.filter((s) => s.status === 'no-show').length,
        };
    });
    const maxBar = Math.max(
        1,
        ...monthStats.map(
            (m) => m.scheduled + m.completed + m.cancelled + m.noShow,
        ),
    );

    // Per-client totals — top 10 by completed session count.
    const perClient = new Map<
        string,
        { name: string; completed: number; cancelled: number; noShow: number }
    >();
    for (const s of sessions) {
        const id = String(s.clientId);
        const c = clientById.get(id);
        const entry = perClient.get(id) ?? {
            name: c ? `${c.firstName} ${c.lastName}` : '(deleted)',
            completed: 0,
            cancelled: 0,
            noShow: 0,
        };
        if (s.status === 'completed') entry.completed++;
        else if (s.status === 'cancelled') entry.cancelled++;
        else if (s.status === 'no-show') entry.noShow++;
        perClient.set(id, entry);
    }
    const topClients = Array.from(perClient.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 10);

    const totals = {
        completed: sessions.filter((s) => s.status === 'completed').length,
        scheduled: sessions.filter((s) => s.status === 'scheduled').length,
        cancelled: sessions.filter((s) => s.status === 'cancelled').length,
        noShow: sessions.filter((s) => s.status === 'no-show').length,
    };
    const completionRate =
        totals.completed + totals.cancelled + totals.noShow > 0
            ? Math.round(
                  (totals.completed * 100) /
                      (totals.completed + totals.cancelled + totals.noShow),
              )
            : 0;

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Psychologist' },
                    { label: 'Reports' },
                ]}
            />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
                <p className="text-sm text-muted-foreground">
                    Aggregated over the last 6 months. PII never enters this
                    page — only counts.
                </p>
            </header>

            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active clients
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {activeClients.length}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Completed sessions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {totals.completed}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Completion rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {completionRate}%
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Upcoming
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {totals.scheduled}
                    </CardContent>
                </Card>
            </section>

            <Card>
                <CardHeader>
                    <CardTitle>Sessions per month</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-6 gap-3 text-xs">
                        {monthStats.map((m) => {
                            const total =
                                m.scheduled + m.completed + m.cancelled + m.noShow;
                            return (
                                <div
                                    key={m.label}
                                    className="flex flex-col items-stretch gap-1"
                                >
                                    <div className="flex h-32 items-end">
                                        <div
                                            className="flex w-full flex-col-reverse overflow-hidden rounded-md border"
                                            style={{
                                                height: `${Math.max(8, (total / maxBar) * 100)}%`,
                                            }}
                                            title={`completed ${m.completed} · scheduled ${m.scheduled} · cancelled ${m.cancelled} · no-show ${m.noShow}`}
                                        >
                                            <div
                                                className="bg-emerald-500/70"
                                                style={{
                                                    height: `${
                                                        total
                                                            ? (m.completed * 100) /
                                                              total
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                            <div
                                                className="bg-sky-500/60"
                                                style={{
                                                    height: `${
                                                        total
                                                            ? (m.scheduled * 100) /
                                                              total
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                            <div
                                                className="bg-amber-500/60"
                                                style={{
                                                    height: `${
                                                        total
                                                            ? (m.noShow * 100) /
                                                              total
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                            <div
                                                className="bg-destructive/60"
                                                style={{
                                                    height: `${
                                                        total
                                                            ? (m.cancelled * 100) /
                                                              total
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center text-muted-foreground">
                                        {m.label}
                                    </div>
                                    <div className="text-center font-mono tabular-nums">
                                        {total}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="inline-block size-3 rounded-sm bg-emerald-500/70" />
                            completed
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block size-3 rounded-sm bg-sky-500/60" />
                            scheduled
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block size-3 rounded-sm bg-amber-500/60" />
                            no-show
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block size-3 rounded-sm bg-destructive/60" />
                            cancelled
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Top clients by completed sessions</CardTitle>
                </CardHeader>
                <CardContent>
                    {topClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No sessions yet.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {topClients.map((c) => (
                                <li
                                    key={c.id}
                                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                                >
                                    <span className="font-medium">{c.name}</span>
                                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] border-emerald-500/50"
                                        >
                                            {c.completed} done
                                        </Badge>
                                        {c.noShow > 0 ? (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] border-amber-500/50"
                                            >
                                                {c.noShow} no-show
                                            </Badge>
                                        ) : null}
                                        {c.cancelled > 0 ? (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] border-destructive/50"
                                            >
                                                {c.cancelled} cancelled
                                            </Badge>
                                        ) : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
