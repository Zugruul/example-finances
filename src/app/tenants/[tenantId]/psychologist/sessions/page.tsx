import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { EmptyState } from '@/components/empty-state';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { CalendarIcon } from 'lucide-react';
import {
    schedulePsychologistSessionAction,
    changePsychologistSessionStatusAction,
} from '@/server/psychologist';

type Params = { tenantId: string };

export const dynamic = 'force-dynamic';

export default async function PsychologistSessionsPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId } = await props.params;
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canManage = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin' || m.role === 'member',
    );

    const [clients, sessions, commInstall, integrations] = await Promise.all([
        readModels.psychologistClients.find({ tenantId }),
        readModels.psychologistSessions.find({ tenantId }),
        readModels.tenantModules.findOne({
            aggregateKey: `${tenantId}|communication`,
        }),
        readModels.communicationIntegrations.find({ tenantId }),
    ]);
    // Cross-module: reminder fields only render when Communication is
    // installed + has at least one enabled integration. Reachable
    // channels are the union of every enabled integration's
    // capabilities, filtered to the ones the user-facing picker
    // exposes (email/sms/whatsapp/telegram cover the common cases).
    const { PROVIDER_CHANNELS } = await import('@/domains/communication');
    const reachable = new Set<string>();
    for (const i of integrations) {
        if (i.status !== 'enabled') continue;
        for (const c of PROVIDER_CHANNELS[i.provider] ?? []) {
            reachable.add(c);
        }
    }
    const reminderChannels = ['email', 'sms', 'whatsapp', 'telegram'].filter(
        (c) => reachable.has(c),
    );
    const remindersAvailable =
        commInstall?.status === 'installed' && reminderChannels.length > 0;

    const activeClients = clients.filter((c) => !c.isArchived);
    const clientById = new Map(
        clients.map((c) => [String(c.clientId), c]),
    );
    const sortedSessions = [...sessions].sort(
        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );

    const create = schedulePsychologistSessionAction.bind(null, tenantId);

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Psychologist' },
                    { label: 'Sessions' },
                ]}
            />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
                <p className="text-sm text-muted-foreground">
                    Appointments with clients. Telehealth sessions can link to a
                    meeting room.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>
                        Upcoming &amp; past ({sortedSessions.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {sortedSessions.length === 0 ? (
                        <EmptyState
                            icon={<CalendarIcon />}
                            title="No sessions yet"
                            description="Schedule one with the form below."
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {sortedSessions.map((s) => {
                                const c = clientById.get(String(s.clientId));
                                const when = new Date(s.startsAt);
                                return (
                                    <li
                                        key={String(s.sessionId)}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="font-medium">
                                                {c
                                                    ? `${c.firstName} ${c.lastName}`
                                                    : '(client deleted)'}
                                            </span>
                                            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <span suppressHydrationWarning>
                                                    {when.toLocaleString()}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px]"
                                                >
                                                    {s.durationMinutes}m
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px]"
                                                >
                                                    {s.modality}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        'text-[10px] ' +
                                                        (s.status === 'completed'
                                                            ? 'border-emerald-500/50'
                                                            : s.status ===
                                                              'cancelled'
                                                            ? 'border-destructive/50'
                                                            : s.status ===
                                                              'no-show'
                                                            ? 'border-amber-500/50'
                                                            : '')
                                                    }
                                                >
                                                    {s.status}
                                                </Badge>
                                                {s.locationLabel ? (
                                                    <span>· {s.locationLabel}</span>
                                                ) : null}
                                            </span>
                                        </div>
                                        {canManage && s.status === 'scheduled' ? (
                                            <div className="flex gap-1">
                                                <form
                                                    action={changePsychologistSessionStatusAction.bind(
                                                        null,
                                                        tenantId,
                                                        String(s.sessionId),
                                                        'completed',
                                                    )}
                                                >
                                                    <SubmitButton
                                                        size="sm"
                                                        variant="outline"
                                                        pendingLabel="…"
                                                    >
                                                        Complete
                                                    </SubmitButton>
                                                </form>
                                                <form
                                                    action={changePsychologistSessionStatusAction.bind(
                                                        null,
                                                        tenantId,
                                                        String(s.sessionId),
                                                        'no-show',
                                                    )}
                                                >
                                                    <SubmitButton
                                                        size="sm"
                                                        variant="ghost"
                                                        pendingLabel="…"
                                                    >
                                                        No-show
                                                    </SubmitButton>
                                                </form>
                                                <form
                                                    action={changePsychologistSessionStatusAction.bind(
                                                        null,
                                                        tenantId,
                                                        String(s.sessionId),
                                                        'cancelled',
                                                    )}
                                                >
                                                    <SubmitButton
                                                        size="sm"
                                                        variant="ghost"
                                                        pendingLabel="…"
                                                    >
                                                        Cancel
                                                    </SubmitButton>
                                                </form>
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage && activeClients.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Schedule a session</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={create} className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="clientId">Client</Label>
                                <select
                                    id="clientId"
                                    name="clientId"
                                    required
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    {activeClients.map((c) => (
                                        <option
                                            key={String(c.clientId)}
                                            value={String(c.clientId)}
                                        >
                                            {c.firstName} {c.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="startsAt">Start (local time)</Label>
                                <Input
                                    id="startsAt"
                                    name="startsAt"
                                    type="datetime-local"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                                <Input
                                    id="durationMinutes"
                                    name="durationMinutes"
                                    type="number"
                                    min={5}
                                    max={480}
                                    defaultValue={50}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="modality">Modality</Label>
                                <select
                                    id="modality"
                                    name="modality"
                                    defaultValue="in-person"
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="in-person">in-person</option>
                                    <option value="telehealth">telehealth</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="locationLabel">Location label</Label>
                                <Input
                                    id="locationLabel"
                                    name="locationLabel"
                                    placeholder="Office room 2 / video link auto-generated for telehealth"
                                />
                            </div>
                            {remindersAvailable ? (
                                <>
                                    <div className="sm:col-span-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                                        Communication is installed — you can
                                        schedule a reminder for this session.
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="reminderChannel">
                                            Reminder channel
                                        </Label>
                                        <select
                                            id="reminderChannel"
                                            name="reminderChannel"
                                            defaultValue=""
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                        >
                                            <option value="">(no reminder)</option>
                                            {reminderChannels.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="reminderHoursBefore">
                                            Reminder lead time
                                        </Label>
                                        <select
                                            id="reminderHoursBefore"
                                            name="reminderHoursBefore"
                                            defaultValue=""
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                        >
                                            <option value="">(no reminder)</option>
                                            <option value="1">1 hour before</option>
                                            <option value="2">2 hours before</option>
                                            <option value="24">24 hours before</option>
                                            <option value="48">48 hours before</option>
                                        </select>
                                    </div>
                                </>
                            ) : null}
                            <div className="sm:col-span-2">
                                <SubmitButton pendingLabel="Scheduling…">
                                    Schedule session
                                </SubmitButton>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            {activeClients.length === 0 && canManage ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Add a client first to schedule sessions.
                </p>
            ) : null}
        </main>
    );
}
