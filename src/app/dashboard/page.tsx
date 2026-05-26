import { auth } from '@/auth';

export default async function DashboardPage() {
    const session = await auth();
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
                Signed in as {session?.user?.email ?? 'unknown'}
            </p>
        </main>
    );
}
