import { readModels } from '@/sorc';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminAuditLogPage() {
    const activity = (await readModels.adminActivity.find({})).sort(
        (a, b) =>
            new Date(b.occurredAt).getTime() -
            new Date(a.occurredAt).getTime(),
    );

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
            <h1 className="text-2xl font-semibold tracking-tight">
                Admin audit log
            </h1>

            <Card>
                <CardHeader>
                    <CardTitle>{activity.length} event(s)</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {activity.length === 0 ? (
                        <p className="text-muted-foreground">
                            No admin actions recorded yet.
                        </p>
                    ) : (
                        activity.map((a) => (
                            <div
                                key={a.eventId}
                                className="flex flex-col gap-1 rounded-md border p-3"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline">{a.kind}</Badge>
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
