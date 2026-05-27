import type { TenantSelectorPref } from '@/domains/users';

export const DEFAULT_TENANT_SELECTOR_PREF: TenantSelectorPref = {
    mode: 'threshold',
    threshold: 3,
};

export function resolveTenantSelectorPref(
    pref: TenantSelectorPref | undefined,
): TenantSelectorPref {
    if (!pref) return DEFAULT_TENANT_SELECTOR_PREF;
    if (pref.mode === 'threshold') {
        const t = pref.threshold;
        return {
            mode: 'threshold',
            threshold:
                typeof t === 'number' && Number.isInteger(t) && t >= 1 && t <= 5
                    ? t
                    : 3,
        };
    }
    return { mode: pref.mode };
}

export function shouldRenderAsList(
    pref: TenantSelectorPref,
    tenantCount: number,
): boolean {
    if (pref.mode === 'list') return true;
    if (pref.mode === 'dropdown') return false;
    return tenantCount <= (pref.threshold ?? 3);
}
