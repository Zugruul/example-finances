import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col gap-6 p-8">
            <BreadcrumbBar items={[{ label: 'Settings' }]} />
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Settings · coming soon
                </h1>
                <p className="text-sm text-muted-foreground">
                    Account preferences and per-tenant defaults will land here.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Preferences</CardTitle>
                    <CardDescription>
                        Nothing to configure yet — this section will host
                        notification, locale, and default-tenant settings in a
                        future release.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Stay tuned.
                    </p>
                </CardContent>
            </Card>
        </main>
    );
}
