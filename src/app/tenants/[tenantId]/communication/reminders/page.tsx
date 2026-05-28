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
import { BellIcon } from 'lucide-react';
import {
    scheduleCommunicationReminderAction,
    cancelCommunicationReminderAction,
} from '@/server/communication';
import { PROVIDER_CHANNELS } from '@/domains/communication';
import type { CommunicationChannel } from '@/domains/communication';

type Params = { tenantId: string };

export const dynamic = 'force-dynamic';

export default async function CommunicationRemindersPage(props: {
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

    const [reminders, integrations] = await Promise.all([
        readModels.communicationReminders.find({ tenantId }),
        readModels.communicationIntegrations.find({ tenantId }),
    ]);
    const enabledIntegrations = integrations.filter(
        (i) => i.status === 'enabled',
    );
    const supportedChannels = new Set<CommunicationChannel>();
    for (const i of enabledIntegrations) {
        for (const c of PROVIDER_CHANNELS[i.provider] ?? []) {
            supportedChannels.add(c);
        }
    }

    const sortedReminders = [...reminders].sort(
        (a, b) => new Date(b.sendAt).getTime() - new Date(a.sendAt).getTime(),
    );

    const schedule = scheduleCommunicationReminderAction.bind(null, tenantId);

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Communication' },
                    { label: 'Reminders' },
                ]}
            />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
                <p className="text-sm text-muted-foreground">
                    Scheduled outbound contact. Channels available depend on
                    the integrations connected on this tenant.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Scheduled ({sortedReminders.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {sortedReminders.length === 0 ? (
                        <EmptyState
                            icon={<BellIcon />}
                            title="No reminders yet"
                            description={
                                supportedChannels.size === 0
                                    ? 'Connect an integration first, then schedule a reminder.'
                                    : 'Schedule your first reminder below.'
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {sortedReminders.map((r) => (
                                <li
                                    key={String(r.reminderId)}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                                >
                                    <div className="flex min-w-0 flex-col">
                                        <span className="font-medium">
                                            {r.recipientLabel}
                                        </span>
                                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <Badge variant="outline" className="text-[10px]">
                                                {r.channel}
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    'text-[10px] ' +
                                                    (r.status === 'sent'
                                                        ? 'border-emerald-500/50'
                                                        : r.status === 'failed'
                                                        ? 'border-destructive/50'
                                                        : r.status === 'cancelled'
                                                        ? 'border-amber-500/50'
                                                        : '')
                                                }
                                            >
                                                {r.status}
                                            </Badge>
                                            <span suppressHydrationWarning>
                                                {new Date(r.sendAt).toLocaleString()}
                                            </span>
                                            {r.linkedEntityKind ? (
                                                <span>
                                                    · {r.linkedEntityKind}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="mt-1 text-sm">
                                            {r.message}
                                        </span>
                                    </div>
                                    {canManage && r.status === 'scheduled' ? (
                                        <form
                                            action={cancelCommunicationReminderAction.bind(
                                                null,
                                                tenantId,
                                                String(r.reminderId),
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
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage && supportedChannels.size > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Schedule a reminder</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={schedule} className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="channel">Channel</Label>
                                <select
                                    id="channel"
                                    name="channel"
                                    required
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    {Array.from(supportedChannels).map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="sendAt">Send at (local time)</Label>
                                <Input
                                    id="sendAt"
                                    name="sendAt"
                                    type="datetime-local"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="recipientLabel">Recipient</Label>
                                <Input
                                    id="recipientLabel"
                                    name="recipientLabel"
                                    required
                                    placeholder="+1 555 555 5555 / name@example.com"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="message">Message</Label>
                                <textarea
                                    id="message"
                                    name="message"
                                    required
                                    rows={3}
                                    className="rounded-md border bg-background px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <SubmitButton pendingLabel="Scheduling…">
                                    Schedule
                                </SubmitButton>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : supportedChannels.size === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Connect a provider on the{' '}
                    <a
                        href={`/tenants/${tenantId}/communication/integrations`}
                        className="text-sky-600 hover:underline dark:text-sky-400"
                    >
                        Integrations
                    </a>{' '}
                    page first.
                </p>
            ) : null}
        </main>
    );
}
