import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/app-sidebar';
import { AppTopBar } from '@/components/app-top-bar';
import { AppShellCommandPalette } from '@/components/app-shell-command-palette';
import { type TenantOption } from '@/components/app-shell-tenant-selector';
import { readLastTenantCookie } from '@/lib/last-tenant-cookie';

export async function AppShell({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user?.id) {
        // Anonymous routes (`/`, `/auth/signin`) render with no shell.
        return <>{children}</>;
    }

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

    // Resolve the last-active tenant from the cookie when the user is
    // on a non-tenant route (the cookie is written by `tenants/[id]/layout`
    // on every tenant-page render). Validate membership so a stale cookie
    // can't leak a tenant the user lost access to.
    const lastTenantId = await readLastTenantCookie();
    const lastTenantIsValid =
        !!lastTenantId && tenants.some((t) => t.tenantId === lastTenantId);
    const activeTenantIdFromCookie = lastTenantIsValid
        ? lastTenantId
        : undefined;

    return (
        <TooltipProvider>
            <SidebarProvider>
                <AppSidebar
                    tenants={tenants}
                    activeTenantId={activeTenantIdFromCookie}
                    isAdmin={isAdmin}
                    email={email}
                />
                <SidebarInset>
                    <AppTopBar email={email} />
                    <div className="flex-1">{children}</div>
                </SidebarInset>
                {tenants.length >= 2 ? (
                    <AppShellCommandPalette tenants={tenants} />
                ) : null}
            </SidebarProvider>
        </TooltipProvider>
    );
}
