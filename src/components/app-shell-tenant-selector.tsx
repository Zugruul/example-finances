'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export type TenantOption = {
    tenantId: string;
    displayName: string;
};

export function AppShellTenantSelector({
    tenants,
}: {
    tenants: TenantOption[];
}) {
    const pathname = usePathname();
    const match = pathname?.match(/^\/tenants\/([^/]+)/);
    const activeId = match?.[1];
    const active = tenants.find((t) => t.tenantId === activeId);
    const label = active?.displayName ?? 'Select tenant';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        aria-label="Switch tenant"
                    >
                        <span
                            className="max-w-[12rem] truncate md:max-w-[18rem] lg:max-w-[24rem]"
                            title={label}
                        >
                            {label}
                        </span>
                        <ChevronDownIcon className="size-4 opacity-60" />
                    </Button>
                }
            />
            <DropdownMenuContent align="start" className="min-w-56">
                {tenants.map((t) => {
                    const isActive = t.tenantId === activeId;
                    return (
                        <DropdownMenuItem
                            key={t.tenantId}
                            render={
                                <Link
                                    href={`/tenants/${t.tenantId}`}
                                    className="flex w-full items-center justify-between"
                                />
                            }
                        >
                            <span className="truncate" title={t.displayName}>
                                {t.displayName}
                            </span>
                            {isActive ? (
                                <CheckIcon className="size-4 opacity-80" />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    render={<Link href="/tenants" className="w-full" />}
                >
                    All tenants
                </DropdownMenuItem>
                <DropdownMenuItem
                    render={<Link href="/tenants/new" className="w-full" />}
                >
                    Add another
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
