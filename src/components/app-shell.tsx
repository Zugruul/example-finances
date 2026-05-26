import Link from 'next/link';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    AppShellTenantSelector,
    type TenantOption,
} from '@/components/app-shell-tenant-selector';
import { AppShellUserMenu } from '@/components/app-shell-user-menu';
import { AppShellMobileMenu } from '@/components/app-shell-mobile-menu';

export async function AppShell() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const memberships = (await readModels.memberships.find({ userId })).filter(
        (m) => !m.removedAt,
    );

    const tenants: TenantOption[] = (
        await Promise.all(
            memberships.map(async (m) => {
                const t = (
                    await readModels.tenants.find({ tenantId: m.tenantId })
                )[0];
                return t
                    ? {
                          tenantId: String(t.tenantId),
                          displayName: t.displayName,
                      }
                    : null;
            }),
        )
    ).filter((x): x is TenantOption => x !== null);

    const isAdmin = session.user.isAdmin === true;
    const email = session.user.email ?? 'unknown';

    return (
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Link
                href="/dashboard"
                className="text-sm font-semibold tracking-tight"
            >
                Finances
            </Link>

            <div className="hidden md:flex md:items-center md:gap-2">
                {tenants.length === 0 ? (
                    <Link
                        href="/tenants/new"
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        Create your first tenant
                    </Link>
                ) : tenants.length === 1 ? (
                    <>
                        <Link
                            href={`/tenants/${tenants[0].tenantId}`}
                            className="text-sm font-medium hover:underline"
                        >
                            {tenants[0].displayName}
                        </Link>
                        <Link
                            href="/tenants/new"
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            Add another
                        </Link>
                    </>
                ) : (
                    <AppShellTenantSelector tenants={tenants} />
                )}
            </div>

            <div className="flex-1" />

            {isAdmin ? (
                <Link
                    href="/admin"
                    className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
                >
                    Admin
                </Link>
            ) : null}

            <AppShellMobileMenu tenants={tenants} showAdmin={isAdmin} />
            <AppShellUserMenu email={email} />
        </header>
    );
}
