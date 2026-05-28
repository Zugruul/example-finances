'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BarChart3Icon,
    BuildingIcon,
    CalendarClockIcon,
    CheckIcon,
    FolderTreeIcon,
    GaugeIcon,
    LayoutDashboardIcon,
    ListTreeIcon,
    LogOutIcon,
    PiggyBankIcon,
    PlusIcon,
    ScrollTextIcon,
    SettingsIcon,
    ShieldCheckIcon,
    UserIcon,
    UsersIcon,
    WalletIcon,
} from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { type TenantOption } from '@/components/app-shell-tenant-selector';
import { signOutAction } from '@/server/auth-actions';
import { tenantSwitchHref } from '@/lib/tenant-switch-href';

export type AppSidebarProps = {
    tenants: TenantOption[];
    activeTenantId: string | undefined;
    isAdmin: boolean;
    email: string;
};

type NavItem = {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    matchPrefix?: string;
};

function tenantNavItems(tenantId: string): NavItem[] {
    return [
        {
            label: 'Dashboard',
            href: `/tenants/${tenantId}/dashboard`,
            icon: LayoutDashboardIcon,
            matchPrefix: `/tenants/${tenantId}/dashboard`,
        },
        {
            label: 'Accounts',
            href: `/tenants/${tenantId}/accounts`,
            icon: WalletIcon,
            matchPrefix: `/tenants/${tenantId}/accounts`,
        },
        {
            label: 'Transactions',
            href: `/tenants/${tenantId}/transactions`,
            icon: ListTreeIcon,
            matchPrefix: `/tenants/${tenantId}/transactions`,
        },
        {
            label: 'Categories',
            href: `/tenants/${tenantId}/categories`,
            icon: FolderTreeIcon,
            matchPrefix: `/tenants/${tenantId}/categories`,
        },
        {
            label: 'Budgets',
            href: `/tenants/${tenantId}/budgets`,
            icon: PiggyBankIcon,
            matchPrefix: `/tenants/${tenantId}/budgets`,
        },
        {
            label: 'Recurring',
            href: `/tenants/${tenantId}/recurring`,
            icon: CalendarClockIcon,
            matchPrefix: `/tenants/${tenantId}/recurring`,
        },
        {
            label: 'Members',
            href: `/tenants/${tenantId}/members`,
            icon: UsersIcon,
            matchPrefix: `/tenants/${tenantId}/members`,
        },
        {
            label: 'Audit',
            href: `/tenants/${tenantId}/audit`,
            icon: ScrollTextIcon,
            matchPrefix: `/tenants/${tenantId}/audit`,
        },
        {
            label: 'Options',
            href: `/tenants/${tenantId}`,
            icon: SettingsIcon,
            // Exact match only — the dashboard / accounts / etc. all
            // share the `/tenants/${tenantId}` prefix.
        },
    ];
}

const ADMIN_NAV: NavItem[] = [
    {
        label: 'Admin home',
        href: '/admin',
        icon: GaugeIcon,
    },
    {
        label: 'Users',
        href: '/admin/users',
        icon: UsersIcon,
        matchPrefix: '/admin/users',
    },
    {
        label: 'Audit log',
        href: '/admin/audit-log',
        icon: ScrollTextIcon,
        matchPrefix: '/admin/audit-log',
    },
];

function isActive(pathname: string, item: NavItem): boolean {
    if (item.matchPrefix) {
        return (
            pathname === item.matchPrefix ||
            pathname.startsWith(`${item.matchPrefix}/`)
        );
    }
    return pathname === item.href;
}

export function AppSidebar({
    tenants,
    activeTenantId,
    isAdmin,
    email,
}: AppSidebarProps) {
    const pathname = usePathname() ?? '';

    // Precedence for the active tenant used by the Workspace nav hrefs:
    //   1. pathname (when on a `/tenants/[id]/...` route)
    //   2. activeTenantId prop (resolved from the `finances.last-tenant`
    //      cookie by AppShell — set on every tenant-page render)
    // When neither resolves, the Workspace group renders DISABLED + muted
    // (no hrefs, reduced opacity) — the user hasn't picked a tenant yet
    // so we won't quietly point links at tenants[0].
    const pathTenantMatch = pathname.match(/^\/tenants\/([^/]+)/);
    const pathTenantId = pathTenantMatch?.[1];
    const isMember = (id: string | undefined) =>
        !!id && tenants.some((t) => t.tenantId === id);
    const resolvedTenantId =
        (isMember(pathTenantId) ? pathTenantId : undefined) ??
        (isMember(activeTenantId) ? activeTenantId : undefined);
    const tenantId =
        resolvedTenantId ??
        (tenants.length > 0 ? tenants[0].tenantId : undefined);
    const workspaceDisabled = !resolvedTenantId && tenants.length > 0;

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <BarChart3Icon className="size-5 shrink-0 text-primary" />
                    <Link
                        href="/dashboard"
                        className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden"
                    >
                        Finances
                    </Link>
                </div>
                {/* Top-level Dashboard — cross-tenant view (filterable by
                    tenant via /dashboard's own dropdown). Sits above the
                    Tenants group; not part of any tenant's workspace. */}
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Dashboard"
                            isActive={pathname === '/dashboard'}
                            render={
                                <Link href="/dashboard">
                                    <LayoutDashboardIcon />
                                    <span>Dashboard</span>
                                </Link>
                            }
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel
                        render={<Link href="/tenants">Tenants</Link>}
                    />
                    <SidebarGroupAction
                        className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        render={
                            <Link href="/tenants/new" aria-label="New tenant">
                                <PlusIcon />
                            </Link>
                        }
                    />
                </SidebarGroup>
                <div className="px-1 group-data-[collapsible=icon]:hidden">
                    {tenants.length === 0 ? (
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    render={
                                        <Link href="/tenants/new">
                                            <BuildingIcon />
                                            <span>Create your first tenant</span>
                                        </Link>
                                    }
                                />
                            </SidebarMenuItem>
                        </SidebarMenu>
                    ) : (
                        // Always render tenants as a list — the
                        // dropdown-vs-list preference was removed in
                        // anticipation of the modules wave where each
                        // tenant becomes its own collapsable tree.
                        <SidebarMenu>
                            {tenants.map((t) => {
                                const isActive = pathname.startsWith(
                                    `/tenants/${t.tenantId}`,
                                );
                                return (
                                    <SidebarMenuItem key={t.tenantId}>
                                        <SidebarMenuButton
                                            isActive={isActive}
                                            render={
                                                <Link
                                                    href={tenantSwitchHref(
                                                        pathname,
                                                        t.tenantId,
                                                    )}
                                                >
                                                    <CheckIcon
                                                        aria-hidden
                                                        className={
                                                            isActive
                                                                ? ''
                                                                : 'opacity-0'
                                                        }
                                                    />
                                                    <span
                                                        className="truncate"
                                                        title={t.displayName}
                                                    >
                                                        {t.displayName}
                                                    </span>
                                                </Link>
                                            }
                                        />
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    )}
                </div>
            </SidebarHeader>
            <SidebarContent>
                {tenantId ? (
                    <SidebarGroup
                        className={
                            workspaceDisabled
                                ? 'pointer-events-none opacity-50'
                                : undefined
                        }
                        aria-disabled={workspaceDisabled || undefined}
                    >
                        <SidebarGroupLabel
                            render={
                                workspaceDisabled ? (
                                    <span
                                        title="Pick a tenant to enable the workspace"
                                        aria-disabled
                                    >
                                        Workspace
                                    </span>
                                ) : (
                                    <Link href="/dashboard">Workspace</Link>
                                )
                            }
                        />
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {tenantNavItems(tenantId).map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                tooltip={item.label}
                                                isActive={
                                                    !workspaceDisabled &&
                                                    isActive(pathname, item)
                                                }
                                                aria-disabled={
                                                    workspaceDisabled ||
                                                    undefined
                                                }
                                                render={
                                                    workspaceDisabled ? (
                                                        <span tabIndex={-1}>
                                                            <Icon />
                                                            <span>
                                                                {item.label}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <Link href={item.href}>
                                                            <Icon />
                                                            <span>
                                                                {item.label}
                                                            </span>
                                                        </Link>
                                                    )
                                                }
                                            />
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ) : null}

                {isAdmin ? (
                    <SidebarGroup className="mt-auto">
                        <SidebarGroupLabel className="flex items-center gap-1.5">
                            <ShieldCheckIcon className="size-3.5" /> Admin
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {ADMIN_NAV.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                tooltip={item.label}
                                                isActive={isActive(
                                                    pathname,
                                                    item,
                                                )}
                                                render={
                                                    <Link href={item.href}>
                                                        <Icon />
                                                        <span>{item.label}</span>
                                                    </Link>
                                                }
                                            />
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ) : null}
            </SidebarContent>
            <SidebarFooter>
                <SidebarSeparator />
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Settings"
                            isActive={pathname === '/settings'}
                            render={
                                <Link href="/settings">
                                    <SettingsIcon />
                                    <span>Settings</span>
                                </Link>
                            }
                        />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip={email}
                            isActive={pathname === '/profile'}
                            render={
                                <Link href="/profile">
                                    <UserIcon />
                                    <span className="truncate" title={email}>
                                        {email}
                                    </span>
                                </Link>
                            }
                        />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <form action={signOutAction}>
                            <SidebarMenuButton
                                tooltip="Sign out"
                                render={
                                    <button
                                        type="submit"
                                        className="w-full text-left"
                                    >
                                        <LogOutIcon />
                                        <span>Sign out</span>
                                    </button>
                                }
                            />
                        </form>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
