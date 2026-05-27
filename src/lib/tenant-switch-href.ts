/**
 * Given the current pathname and a target tenantId, return the href the
 * tenant switcher should navigate to so the user stays on the same
 * "page" within the new workspace.
 *
 * Behavior:
 *   - `/tenants/<id>/<section>`              → `/tenants/<newId>/<section>`
 *       for known tenant sections (audit, accounts, transactions, etc.).
 *   - `/tenants/<id>/<section>/<resourceId>` → `/tenants/<newId>/<section>`
 *       (resource ids are tenant-scoped, so we drop them rather than
 *        risk a 404).
 *   - anything else (incl. `/tenants/<id>`, `/dashboard`, `/settings`)
 *       → `/tenants/<newId>` (dashboard for the new tenant).
 */

const TENANT_SECTIONS = new Set([
    'accounts',
    'transactions',
    'categories',
    'budgets',
    'recurring',
    'members',
    'audit',
]);

export function tenantSwitchHref(
    pathname: string,
    newTenantId: string,
): string {
    const m = pathname.match(/^\/tenants\/([^/]+)(?:\/([^/]+))?(?:\/.*)?$/);
    if (!m) return `/tenants/${newTenantId}`;
    const section = m[2];
    if (section && TENANT_SECTIONS.has(section)) {
        return `/tenants/${newTenantId}/${section}`;
    }
    return `/tenants/${newTenantId}`;
}
