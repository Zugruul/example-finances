'use client';

import Link from 'next/link';
import { UserIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/server/auth-actions';

export function AppShellUserMenu({ email }: { email: string }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label="User menu"
                        className="gap-2"
                    >
                        <UserIcon className="size-4" />
                        <span className="hidden md:inline">{email}</span>
                    </Button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="truncate text-muted-foreground">
                    {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/profile" />}>
                    Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={signOutAction}>
                    <DropdownMenuItem
                        render={
                            <button
                                type="submit"
                                className="w-full text-left"
                            />
                        }
                    >
                        Sign out
                    </DropdownMenuItem>
                </form>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
