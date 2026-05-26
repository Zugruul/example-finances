import { auth } from '@/auth';
import { endImpersonationAction } from '@/server/admin';
import { Button } from '@/components/ui/button';

export async function ImpersonationBanner() {
    const session = await auth();
    const imp = session?.user?.impersonation;
    if (!imp) return null;

    return (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-amber-500/90 px-4 py-2 text-sm text-amber-950 dark:bg-amber-500/80">
            <span>
                Impersonating <strong>{imp.targetEmail}</strong>
            </span>
            <form action={endImpersonationAction}>
                <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="bg-white"
                >
                    Return to admin
                </Button>
            </form>
        </div>
    );
}
