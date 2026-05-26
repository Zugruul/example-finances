import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';

export default async function Home() {
    // Signed-in users skip the landing splash — bounce straight to the
    // dashboard. Unauthenticated visitors see the marketing page below.
    const session = await auth();
    if (session?.user?.id) redirect('/dashboard');

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
            <div className="flex flex-col items-center gap-3 text-center">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                    Finances
                </h1>
                <p className="max-w-md text-base text-muted-foreground">
                    A reference event-sourced finance tracker. Multi-tenant from
                    day one, with cryptoshredding-grade PII handling.
                </p>
            </div>
            <Link href="/auth/signin">
                <Button size="lg">Sign in</Button>
            </Link>
        </main>
    );
}
