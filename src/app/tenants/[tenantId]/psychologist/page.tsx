import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import {
    CalendarIcon,
    LockIcon,
    NotebookPenIcon,
    UsersIcon,
} from 'lucide-react';

type Params = { tenantId: string };

export const dynamic = 'force-dynamic';

function startOfWeek(d: Date): Date {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    const dow = out.getUTCDay();
    out.setUTCDate(out.getUTCDate() - dow);
    return out;
}

export default async function PsychologistOverviewPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId } = await props.params;
    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const session = await auth();
    void session;

    const [clients, sessions, notes] = await Promise.all([
        readModels.psychologistClients.find({ tenantId }),
        readModels.psychologistSessions.find({ tenantId }),
        readModels.psychologistNotes.find({ tenantId }),
    ]);
    const activeClients = clients.filter((c) => !c.isArchived);

    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const upcoming = sessions
        .filter(
            (s) =>
                s.status === 'scheduled' &&
                new Date(s.startsAt) >= now,
        )
        .sort(
            (a, b) =>
                new Date(a.startsAt).getTime() -
                new Date(b.startsAt).getTime(),
        )
        .slice(0, 5);

    const inWindow = (
        within: (d: Date) => boolean,
    ): {
        total: number;
        scheduled: number;
        completed: number;
        cancelled: number;
        noShow: number;
    } => {
        const ws = sessions.filter((s) => within(new Date(s.startsAt)));
        return {
            total: ws.length,
            scheduled: ws.filter((s) => s.status === 'scheduled').length,
            completed: ws.filter((s) => s.status === 'completed').length,
            cancelled: ws.filter((s) => s.status === 'cancelled').length,
            noShow: ws.filter((s) => s.status === 'no-show').length,
        };
    };
    const weekStats = inWindow(
        (d) => d >= weekStart && d < new Date(weekStart.getTime() + 7 * 86_400_000),
    );
    const monthStats = inWindow((d) => d >= monthStart);

    const clientById = new Map(
        clients.map((c) => [String(c.clientId), c]),
    );

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
                ]}
            />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Psychologist
                </h1>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LockIcon className="size-3.5" />
                    Clinical PII is cryptoshredded per-tenant.
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
                            Sessions this week
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {weekStats.total}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Sessions this month
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {monthStats.total}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Notes (total)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-3xl font-semibold">
                        {notes.length}
                    </CardContent>
                </Card>
            </section>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <CardTitle>Next 5 sessions</CardTitle>
                    <Link href={`/tenants/${tenantId}/psychologist/sessions`}>
                        <Button variant="outline" size="sm">
                            All sessions
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {upcoming.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Nothing scheduled.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {upcoming.map((s) => {
                                const c = clientById.get(String(s.clientId));
                                return (
                                    <li
                                        key={String(s.sessionId)}
                                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {c
                                                    ? `${c.firstName} ${c.lastName}`
                                                    : '(client deleted)'}
                                            </span>
                                            <span
                                                suppressHydrationWarning
                                                className="text-xs text-muted-foreground"
                                            >
                                                {new Date(s.startsAt).toLocaleString()}{' '}
                                                · {s.durationMinutes}m
                                            </span>
                                        </div>
                                        <Badge variant="outline">
                                            {s.modality}
                                        </Badge>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Link
                    href={`/tenants/${tenantId}/psychologist/clients`}
                    className="rounded-md border p-4 transition hover:bg-accent/40"
                >
                    <div className="flex items-center gap-2">
                        <UsersIcon className="size-4 text-muted-foreground" />
                        <span className="font-medium">Clients</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Add, archive, and manage client records.
                    </p>
                </Link>
                <Link
                    href={`/tenants/${tenantId}/psychologist/sessions`}
                    className="rounded-md border p-4 transition hover:bg-accent/40"
                >
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="size-4 text-muted-foreground" />
                        <span className="font-medium">Sessions</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Schedule appointments + status changes.
                    </p>
                </Link>
                <Link
                    href={`/tenants/${tenantId}/psychologist/notes`}
                    className="rounded-md border p-4 transition hover:bg-accent/40"
                >
                    <div className="flex items-center gap-2">
                        <NotebookPenIcon className="size-4 text-muted-foreground" />
                        <span className="font-medium">Notes</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Cryptoshredded clinical notes, lockable.
                    </p>
                </Link>
            </section>
        </main>
    );
}
