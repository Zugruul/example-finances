'use client';

import { useRouter } from 'next/navigation';

export interface TenantFilterOption {
    id: string;
    displayName: string;
}

interface Props {
    options: TenantFilterOption[];
    /** Currently selected tenantId, or undefined for 'all'. */
    value: string | undefined;
}

/**
 * Top-of-dashboard filter — switches the page's `?tenantId` query param.
 * Hidden when the user has only one tenant (filtering is moot).
 *
 * Using `useRouter().push` (vs a plain `<a>`) keeps the client cache
 * warm so the dashboard refresh after a filter switch is a fast partial
 * render instead of a full reload.
 */
export function TenantFilter({ options, value }: Props) {
    const router = useRouter();
    if (options.length <= 1) return null;

    return (
        <select
            aria-label="Filter by tenant"
            value={value ?? 'all'}
            onChange={(e) => {
                const v = e.target.value;
                const url =
                    v === 'all'
                        ? '/dashboard'
                        : `/dashboard?tenantId=${encodeURIComponent(v)}`;
                router.push(url);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
        >
            <option value="all">All tenants</option>
            {options.map((o) => (
                <option key={o.id} value={o.id}>
                    {o.displayName}
                </option>
            ))}
        </select>
    );
}
