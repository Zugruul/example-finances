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
import { PlugIcon, LockIcon } from 'lucide-react';
import {
    connectCommunicationIntegrationAction,
    disableCommunicationIntegrationAction,
    enableCommunicationIntegrationAction,
    removeCommunicationIntegrationAction,
} from '@/server/communication';
import { PROVIDER_CHANNELS } from '@/domains/communication';

type Params = { tenantId: string };

export const dynamic = 'force-dynamic';

const PROVIDER_LABELS: Record<string, string> = {
    twilio: 'Twilio (SMS / MMS / Voice / RCS)',
    resend: 'Resend (Email)',
    'whatsapp-cloud': 'WhatsApp Cloud',
    telegram: 'Telegram Bot',
    wechat: 'WeChat / Weixin',
};

const PROVIDER_HINTS: Record<string, string> = {
    twilio:
        '{"accountSid": "AC...", "authToken": "...", "fromPhoneNumber": "+1..."}',
    resend: '{"apiKey": "re_...", "fromEmail": "no-reply@yourdomain.com"}',
    'whatsapp-cloud':
        '{"accessToken": "EAA...", "phoneNumberId": "...", "verifyToken": "..."}',
    telegram: '{"botToken": "123:ABC..."}',
    wechat: '{"appId": "wx...", "appSecret": "..."}',
};

export default async function CommunicationIntegrationsPage(props: {
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
        (m) => m.role === 'owner' || m.role === 'admin',
    );

    const integrations = await readModels.communicationIntegrations.find({
        tenantId,
    });

    const connect = connectCommunicationIntegrationAction.bind(
        null,
        tenantId,
    );

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
                    { label: 'Integrations' },
                ]}
            />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Integrations
                </h1>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LockIcon className="size-3.5" />
                    Provider credentials are cryptoshredded — dropping this
                    tenant's key invalidates every stored secret.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>
                        Connected providers ({integrations.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {integrations.length === 0 ? (
                        <EmptyState
                            icon={<PlugIcon />}
                            title="No integrations yet"
                            description="Connect Twilio, Resend, WhatsApp, Telegram, or WeChat to send reminders."
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {integrations.map((i) => {
                                const channels =
                                    PROVIDER_CHANNELS[i.provider] ?? [];
                                return (
                                    <li
                                        key={String(i.integrationId)}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="font-medium">
                                                {i.label}
                                            </span>
                                            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px]"
                                                >
                                                    {i.provider}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        'text-[10px] ' +
                                                        (i.status === 'enabled'
                                                            ? 'border-emerald-500/50'
                                                            : 'border-amber-500/50')
                                                    }
                                                >
                                                    {i.status}
                                                </Badge>
                                                {channels.map((c) => (
                                                    <span key={c}>{c}</span>
                                                ))}
                                            </span>
                                        </div>
                                        {canManage ? (
                                            <div className="flex gap-1">
                                                {i.status === 'enabled' ? (
                                                    <form
                                                        action={disableCommunicationIntegrationAction.bind(
                                                            null,
                                                            tenantId,
                                                            String(i.integrationId),
                                                        )}
                                                    >
                                                        <SubmitButton
                                                            size="sm"
                                                            variant="outline"
                                                            pendingLabel="…"
                                                        >
                                                            Disable
                                                        </SubmitButton>
                                                    </form>
                                                ) : (
                                                    <form
                                                        action={enableCommunicationIntegrationAction.bind(
                                                            null,
                                                            tenantId,
                                                            String(i.integrationId),
                                                        )}
                                                    >
                                                        <SubmitButton
                                                            size="sm"
                                                            pendingLabel="…"
                                                        >
                                                            Enable
                                                        </SubmitButton>
                                                    </form>
                                                )}
                                                <form
                                                    action={removeCommunicationIntegrationAction.bind(
                                                        null,
                                                        tenantId,
                                                        String(i.integrationId),
                                                    )}
                                                >
                                                    <SubmitButton
                                                        size="sm"
                                                        variant="ghost"
                                                        pendingLabel="…"
                                                    >
                                                        Remove
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

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Connect a provider</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={connect} className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="provider">Provider</Label>
                                <select
                                    id="provider"
                                    name="provider"
                                    required
                                    defaultValue="twilio"
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    {Object.entries(PROVIDER_LABELS).map(
                                        ([id, label]) => (
                                            <option key={id} value={id}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="label">Label</Label>
                                <Input
                                    id="label"
                                    name="label"
                                    required
                                    placeholder="Main Twilio"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="config">Config (JSON)</Label>
                                <textarea
                                    id="config"
                                    name="config"
                                    rows={4}
                                    required
                                    className="rounded-md border bg-background px-3 py-2 font-mono text-xs"
                                    placeholder={PROVIDER_HINTS.twilio}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Per-provider shape:
                                </p>
                                <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                    {Object.entries(PROVIDER_HINTS).map(
                                        ([id, hint]) => (
                                            <li key={id} className="font-mono">
                                                <span className="font-sans font-medium">
                                                    {id}:
                                                </span>{' '}
                                                {hint}
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </div>
                            <div className="sm:col-span-2">
                                <SubmitButton pendingLabel="Connecting…">
                                    Connect
                                </SubmitButton>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
