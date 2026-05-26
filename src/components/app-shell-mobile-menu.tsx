'use client';

import Link from 'next/link';
import { MenuIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { TenantOption } from './app-shell-tenant-selector';

export function AppShellMobileMenu({
    tenants,
    showAdmin,
}: {
    tenants: TenantOption[];
    showAdmin: boolean;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Open menu"
                        className="md:hidden"
                    >
                        <MenuIcon className="size-5" />
                    </Button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-56">
                {tenants.length > 0 ? (
                    <>
                        <DropdownMenuLabel>Tenants</DropdownMenuLabel>
                        {tenants.map((t) => (
                            <DropdownMenuItem
                                key={t.tenantId}
                                render={
                                    <Link
                                        href={`/tenants/${t.tenantId}`}
                                        className="w-full truncate"
                                        title={t.displayName}
                                    />
                                }
                            >
                                {t.displayName}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem
                            render={<Link href="/tenants" className="w-full" />}
                        >
                            All tenants
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            render={
                                <Link href="/tenants/new" className="w-full" />
                            }
                        >
                            Add another
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                ) : (
                    <>
                        <DropdownMenuItem
                            render={
                                <Link href="/tenants/new" className="w-full" />
                            }
                        >
                            Create your first tenant
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                {showAdmin ? (
                    <DropdownMenuItem
                        render={<Link href="/admin" className="w-full" />}
                    >
                        Admin
                    </DropdownMenuItem>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
