'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BarChart3Icon,
    BuildingIcon,
    CalendarClockIcon,
    ChevronRightIcon,
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
import { Boxes, Building2Icon } from 'lucide-react';
import { FINANCES_MODULE_ID, financesModule } from '@/modules/finances.manifest';

export type AppSidebarProps = {
    tenants: TenantOption[];
    activeTenantId: string | undefined;
    isAdmin: boolean;
    email: string;
    /** Module ids installed (and not disabled) per tenant. */
    installedModulesByTenant: Record<string, string[]>;
};

type NavItem = {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    matchPrefix?: string;
};

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
    isAdmin,
    email,
    installedModulesByTenant,
}: AppSidebarProps) {
    const pathname = usePathname() ?? '';

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
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Audit log"
                            isActive={pathname === '/audit'}
                            render={
                                <Link href="/audit">
                                    <ScrollTextIcon />
                                    <span>Audit</span>
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
            </SidebarHeader>
            <SidebarContent>
                {tenants.length === 0 ? (
                    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
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
                    </SidebarGroup>
                ) : (
                    // One collapsible group per tenant. The group that
                    // contains the current pathname starts expanded;
                    // others stay collapsed. Click the tenant header
                    // to expand/collapse manually.
                    <div className="flex flex-col gap-1 px-1 group-data-[collapsible=icon]:hidden">
                        {tenants.map((t) => (
                            <TenantTree
                                key={t.tenantId}
                                tenant={t}
                                pathname={pathname}
                                installedModules={
                                    installedModulesByTenant[t.tenantId] ?? []
                                }
                            />
                        ))}
                    </div>
                )}

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
                            tooltip="Modules"
                            isActive={
                                pathname === '/modules' ||
                                pathname.startsWith('/modules/')
                            }
                            render={
                                <Link href="/modules">
                                    <Boxes />
                                    <span>Modules</span>
                                </Link>
                            }
                        />
                    </SidebarMenuItem>
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

/**
 * One collapsible per-tenant tree. The tenant whose subtree contains
 * the current pathname auto-expands; others start collapsed. Click
 * the header to toggle. Module pages (currently just Finances) render
 * as a sub-group with its own chevron; built-ins (Members, Audit,
 * Options) live above the modules.
 */
function TenantTree({
    tenant,
    pathname,
    installedModules,
}: {
    tenant: TenantOption;
    pathname: string;
    installedModules: string[];
}) {
    const inSubtree = pathname.startsWith(`/tenants/${tenant.tenantId}`);
    const [open, setOpen] = useState(inSubtree);
    // Sync with route changes — when the user navigates INTO this
    // tenant's subtree from elsewhere, expand automatically.
    const hasFinances = installedModules.includes(FINANCES_MODULE_ID);
    const tenantId = tenant.tenantId;

    return (
        <div className="rounded-md">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={
                    'group/header flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition hover:bg-sidebar-accent ' +
                    (inSubtree ? 'bg-sidebar-accent/40' : '')
                }
                aria-expanded={open || inSubtree}
            >
                <ChevronRightIcon
                    className={
                        'size-3.5 shrink-0 text-muted-foreground transition-transform ' +
                        (open || inSubtree ? 'rotate-90' : '')
                    }
                />
                <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate" title={tenant.displayName}>
                    {tenant.displayName}
                </span>
            </button>
            {open || inSubtree ? (
                <div className="ml-3 mt-1 flex flex-col border-l pl-2">
                    {hasFinances ? (
                        <ModuleGroup
                            module={financesModule}
                            tenantId={tenantId}
                            pathname={pathname}
                        />
                    ) : null}
                    {/* Built-in items always present */}
                    <NavLink
                        href={`/tenants/${tenantId}/members`}
                        label="Members"
                        icon={UsersIcon}
                        active={pathname.startsWith(
                            `/tenants/${tenantId}/members`,
                        )}
                    />
                    <NavLink
                        href={`/tenants/${tenantId}/audit`}
                        label="Audit"
                        icon={ScrollTextIcon}
                        active={pathname.startsWith(
                            `/tenants/${tenantId}/audit`,
                        )}
                    />
                    <NavLink
                        href={`/tenants/${tenantId}`}
                        label="Options"
                        icon={SettingsIcon}
                        active={pathname === `/tenants/${tenantId}`}
                    />
                    {!hasFinances ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No modules installed.{' '}
                            <Link
                                href="/modules"
                                className="text-sky-600 hover:underline dark:text-sky-400"
                            >
                                Install →
                            </Link>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function ModuleGroup({
    module: m,
    tenantId,
    pathname,
}: {
    module: typeof financesModule;
    tenantId: string;
    pathname: string;
}) {
    const Icon = m.icon;
    const moduleActive = m.pages.some((p) =>
        pathname.startsWith(`/tenants/${tenantId}${p.href}`),
    );
    const [open, setOpen] = useState(moduleActive);
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="group/m flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground transition hover:bg-sidebar-accent"
                aria-expanded={open || moduleActive}
            >
                <ChevronRightIcon
                    className={
                        'size-3 shrink-0 transition-transform ' +
                        (open || moduleActive ? 'rotate-90' : '')
                    }
                />
                <Icon className="size-3.5" />
                <span>{m.name}</span>
            </button>
            {open || moduleActive ? (
                <div className="ml-3 flex flex-col">
                    {m.pages
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((p) => {
                            const href = `/tenants/${tenantId}${p.href}`;
                            return (
                                <NavLink
                                    key={p.id}
                                    href={href}
                                    label={p.label}
                                    icon={p.icon}
                                    active={
                                        pathname === href ||
                                        pathname.startsWith(`${href}/`)
                                    }
                                />
                            );
                        })}
                </div>
            ) : null}
        </div>
    );
}

function NavLink({
    href,
    label,
    icon: Icon,
    active,
}: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
}) {
    return (
        <Link
            href={href}
            className={
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-sidebar-accent ' +
                (active
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80')
            }
        >
            <Icon className="size-4" />
            <span className="truncate" title={label}>
                {label}
            </span>
        </Link>
    );
}
