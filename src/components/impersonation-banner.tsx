import { auth } from '@/auth';
import { endImpersonationAction } from '@/server/admin';
import { Button } from '@/components/ui/button';
import { impersonationRemainingMs } from '@/lib/impersonation';

// Top-level helper so the React 19 `react-hooks/purity` rule doesn't
// flag the time math inside the server component body (see gotchas).
function formatRemaining(ms: number): string {
    if (ms <= 0) return '0m remaining';
    const totalMinutes = Math.floor(ms / 60_000);
    if (totalMinutes >= 60) {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}h ${m}m remaining`;
    }
    if (totalMinutes >= 1) return `${totalMinutes}m remaining`;
    // < 1 minute — show seconds so the cliff is obvious.
    const seconds = Math.max(1, Math.floor(ms / 1000));
    return `${seconds}s remaining`;
}

export async function ImpersonationBanner() {
    const session = await auth();
    const imp = session?.user?.impersonation;
    if (!imp) return null;

    const remaining = formatRemaining(impersonationRemainingMs(imp));

    return (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-amber-500/90 px-4 py-2 text-sm text-amber-950 dark:bg-amber-500/80">
            <span>
                Impersonating <strong>{imp.targetEmail}</strong>
                <span className="ml-2 text-amber-900/80 dark:text-amber-100/80">
                    · {remaining}
                </span>
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
