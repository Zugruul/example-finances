'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BarChart3Icon,
    BuildingIcon,
    CalendarClockIcon,
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
import {
    AppShellTenantSelector,
    type TenantOption,
} from '@/components/app-shell-tenant-selector';
import { signOutAction } from '@/server/auth-actions';

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
            href: `/tenants/${tenantId}`,
            icon: LayoutDashboardIcon,
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

    const tenantId =
        activeTenantId ?? (tenants.length > 0 ? tenants[0].tenantId : undefined);

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
                <SidebarGroup className="px-0 py-0 group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel
                        render={<Link href="/tenants">Tenants</Link>}
                    />
                    <SidebarGroupAction
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
                    ) : tenants.length === 1 ? (
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={
                                        tenantId === tenants[0].tenantId &&
                                        pathname.startsWith(
                                            `/tenants/${tenants[0].tenantId}`,
                                        )
                                    }
                                    render={
                                        <Link
                                            href={`/tenants/${tenants[0].tenantId}`}
                                        >
                                            <BuildingIcon />
                                            <span
                                                className="truncate"
                                                title={tenants[0].displayName}
                                            >
                                                {tenants[0].displayName}
                                            </span>
                                        </Link>
                                    }
                                />
                            </SidebarMenuItem>
                        </SidebarMenu>
                    ) : (
                        <AppShellTenantSelector tenants={tenants} />
                    )}
                </div>
            </SidebarHeader>
            <SidebarContent>
                {tenantId ? (
                    <SidebarGroup>
                        <SidebarGroupLabel
                            render={<Link href="/dashboard">Workspace</Link>}
                        />
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {tenantNavItems(tenantId).map((item) => {
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
