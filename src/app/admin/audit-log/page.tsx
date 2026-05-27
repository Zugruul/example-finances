import { readModels } from '@/sorc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { ScrollTextIcon } from 'lucide-react';

export default async function AdminAuditLogPage() {
    const activity = (await readModels.adminActivity.find({})).sort(
        (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

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
                                className="flex flex-col gap-1 rounded-md border p-3"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">
                                            {a.kind}
                                        </Badge>
                                        {a.kind === 'ImpersonationEnded' &&
                                        a.reason === 'expired' ? (
                                            <Badge
                                                variant="outline"
                                                className="border-amber-500 text-amber-700 dark:text-amber-300"
                                            >
                                                expired
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(
                                            a.occurredAt,
                                        ).toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-muted-foreground">
                                        admin:
                                    </span>{' '}
                                    {a.actorAdminId}
                                </div>
                                {a.targetEmail ? (
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">
                                            target:
                                        </span>{' '}
                                        {a.targetEmail}
                                    </div>
                                ) : null}
                                {a.action ? (
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">
                                            action:
                                        </span>{' '}
                                        {a.action}
                                        {a.note ? ` — ${a.note}` : ''}
                                    </div>
                                ) : null}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
