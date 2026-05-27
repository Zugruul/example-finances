'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Tenant-scoped nav links rendered in the app shell when the user is
 * inside a `/tenants/{tenantId}/...` route. The current tenant is
 * derived from `usePathname` so the links stay anchored to the
 * actively-viewed tenant regardless of how many memberships the user has.
 */
export function AppShellTenantNav() {
    const pathname = usePathname();
    const match = pathname.match(/^\/tenants\/([^/]+)(?:\/|$)/);
    if (!match) return null;
    const tenantId = match[1];
    if (tenantId === 'new') return null;

    return (
        <nav className="hidden items-center gap-3 md:flex">
            <span
                aria-hidden="true"
                className="text-muted-foreground/50"
            >
                /
            </span>
            <Link
                href={`/tenants/${tenantId}/accounts`}
                className="text-sm text-muted-foreground hover:text-foreground"
            >
                Accounts
            </Link>
            <Link
                href={`/tenants/${tenantId}/categories`}
                className="text-sm text-muted-foreground hover:text-foreground"
            >
                Categories
            </Link>
            <Link
                href={`/tenants/${tenantId}/transactions`}
                className="text-sm text-muted-foreground hover:text-foreground"
            >
                Transactions
            </Link>
            <Link
                href={`/tenants/${tenantId}/budgets`}
                className="text-sm text-muted-foreground hover:text-foreground"
            >
                Budgets
            </Link>
            <Link
                href={`/tenants/${tenantId}/recurring`}
                className="text-sm text-muted-foreground hover:text-foreground"
            >
                Recurring
            </Link>
        </nav>
    );
}
