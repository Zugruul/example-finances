import { redirect } from 'next/navigation';
import { ScrollTextIcon } from 'lucide-react';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import type { SorcUUID } from '@event-sorcerer/core';
import type { UserSettingsAuditDoc } from '@/domains/users/user-settings-audit.readmodel';

const PROFILE_FIELD_LABELS: Record<string, string> = {
    firstName: 'first name',
    lastName: 'last name',
    phoneNumber: 'phone number',
    address: 'address',
};

function summarize(row: UserSettingsAuditDoc): string {
    switch (row.kind) {
        case 'UserProfileUpdated': {
            const changed = Object.keys(row.changes).filter(
                (k) => PROFILE_FIELD_LABELS[k],
            );
            if (changed.length === 0) return 'Profile updated';
            const labels = changed.map((k) => PROFILE_FIELD_LABELS[k]);
            return `Profile updated: ${labels.join(', ')}`;
        }
        case 'UserDefaultCurrencyChanged':
            return `Default currency set to ${row.changes.currency ?? '?'}`;
        case 'UserTenantSelectorPrefChanged': {
            const mode = row.changes.mode ?? '?';
            const threshold = row.changes.threshold;
            if (mode === 'threshold' && typeof threshold === 'number') {
                return `Tenant selector preference: threshold (${threshold})`;
            }
            return `Tenant selector preference: ${mode}`;
        }
        default:
            return (row as { kind: string }).kind;
    }
}

export default async function SettingsAuditPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const userId = session.user.id as SorcUUID;
    const rows = (
        await readModels.userSettingsAudit.find({ userId })
    ).sort(
        (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Settings', href: '/settings' },
                    { label: 'Audit' },
                ]}
            />
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Settings audit
                </h1>
                <p className="text-sm text-muted-foreground">
                    A chronological record of every change made to your
                    personal preferences.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{rows.length} change(s)</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {rows.length === 0 ? (
                        <EmptyState
                            icon={<ScrollTextIcon />}
                            title="No settings changes yet"
                            description="Updates to your profile, default currency, and tenant selector preference will show up here once recorded."
                        />
                    ) : (
                        rows.map((r) => (
                            <div
                                key={r.eventId}
                                className="flex flex-col gap-2 rounded-md border p-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-medium leading-snug">
                                        {summarize(r)}
                                    </p>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {new Date(
                                            r.occurredAt,
                                        ).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <Badge
                                        variant="outline"
                                        className="text-[10px]"
                                    >
                                        {r.kind}
                                    </Badge>
                                    <details className="text-xs text-muted-foreground">
                                        <summary className="cursor-pointer select-none hover:text-foreground">
                                            raw payload
                                        </summary>
                                        <pre className="mt-2 overflow-x-auto rounded-sm border bg-muted/40 p-2 text-[11px] leading-snug">
                                            {JSON.stringify(
                                                r.changes,
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    </details>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
