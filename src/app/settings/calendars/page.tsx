import { redirect } from 'next/navigation';
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
import { CalendarIcon, LockIcon } from 'lucide-react';
import {
    connectCalendarAction,
    disconnectCalendarAction,
    syncCalendarAction,
} from '@/server/calendar';
import { listCalendarProviders } from '@/lib/calendar-providers';
import type { SorcUUID } from '@event-sorcerer/core';

export const dynamic = 'force-dynamic';

export default async function CalendarsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const connections = await readModels.calendarConnections.find({
        userId: session.user.id as SorcUUID,
    });
    const providers = listCalendarProviders();

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Settings', href: '/settings' },
                    { label: 'Calendars' },
                ]}
            />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Connected calendars
                </h1>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LockIcon className="size-3.5" />
                    Access tokens are cryptoshredded per-user — only you (or
                    code running on your behalf) can decrypt them.
                </p>
                <p className="rounded-md border border-amber-500/40 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    Real OAuth + sync is per-provider follow-up work — the
                    storage layer is in place and the adapter contract is
                    fixed, but each provider's actual implementation is a
                    stub today. Paste an existing access token to exercise
                    the connection storage end-to-end.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>
                        Connections ({connections.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {connections.length === 0 ? (
                        <EmptyState
                            icon={<CalendarIcon />}
                            title="No calendars connected"
                            description="Link iCloud, Gmail, Outlook, or any CalDAV calendar below."
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {connections.map((c) => (
                                <li
                                    key={String(c.connectionId)}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                                >
                                    <div className="flex min-w-0 flex-col">
                                        <span className="font-medium">
                                            {c.displayLabel}
                                        </span>
                                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <Badge variant="outline" className="text-[10px]">
                                                {c.provider}
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    'text-[10px] ' +
                                                    (c.status === 'connected'
                                                        ? 'border-emerald-500/50'
                                                        : c.status === 'expired'
                                                        ? 'border-amber-500/50'
                                                        : 'border-destructive/50')
                                                }
                                            >
                                                {c.status}
                                            </Badge>
                                            <span>{c.accountEmail}</span>
                                            {c.lastSyncedAt ? (
                                                <span suppressHydrationWarning>
                                                    last synced{' '}
                                                    {new Date(
                                                        c.lastSyncedAt,
                                                    ).toLocaleString()}
                                                </span>
                                            ) : (
                                                <span>never synced</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <form
                                            action={syncCalendarAction.bind(
                                                null,
                                                String(c.connectionId),
                                            )}
                                        >
                                            <SubmitButton
                                                size="sm"
                                                variant="outline"
                                                pendingLabel="Syncing…"
                                            >
                                                Sync now
                                            </SubmitButton>
                                        </form>
                                        <form
                                            action={disconnectCalendarAction.bind(
                                                null,
                                                String(c.connectionId),
                                            )}
                                        >
                                            <SubmitButton
                                                size="sm"
                                                variant="ghost"
                                                pendingLabel="…"
                                            >
                                                Disconnect
                                            </SubmitButton>
                                        </form>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Connect a calendar</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        action={connectCalendarAction}
                        className="grid gap-3 sm:grid-cols-2"
                    >
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="provider">Provider</Label>
                            <select
                                id="provider"
                                name="provider"
                                required
                                defaultValue="google"
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                            >
                                {providers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                            <ul className="grid gap-0.5 text-[10px] text-muted-foreground">
                                {providers.map((p) => (
                                    <li key={p.id}>
                                        <span className="font-medium">{p.label}:</span>{' '}
                                        {p.description}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="accountEmail">Account email</Label>
                            <Input
                                id="accountEmail"
                                name="accountEmail"
                                type="email"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="displayLabel">Label</Label>
                            <Input
                                id="displayLabel"
                                name="displayLabel"
                                placeholder="Work calendar"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="refreshToken">Refresh token (optional)</Label>
                            <Input id="refreshToken" name="refreshToken" />
                        </div>
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor="accessToken">Access token</Label>
                            <Input
                                id="accessToken"
                                name="accessToken"
                                required
                                placeholder="ya29...."
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <SubmitButton pendingLabel="Connecting…">
                                Connect
                            </SubmitButton>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
