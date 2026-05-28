import type { LucideIcon } from 'lucide-react';

/**
 * Module manifest. Each module declares its identity, the pages it
 * contributes to the per-tenant sidebar, and metadata the framework
 * uses to gate routes + render the catalog.
 *
 * Manifests are static code — they don't live in Mongo. The
 * `tenant-modules` read model stores PER-TENANT install state; the
 * manifest is the source of truth for "what does the module DO when
 * it's installed".
 */
export interface ModulePage {
    /** Stable id within the module — used for per-page role gates. */
    id: string;
    label: string;
    /** Page path RELATIVE to `/tenants/[tenantId]`. Starts with `/`. */
    href: string;
    icon: LucideIcon;
    /** Sort order in the sidebar (low → high). */
    order: number;
}

export interface ModuleManifest {
    id: string;
    version: string;
    name: string;
    description: string;
    icon: LucideIcon;
    /**
     * If `true`, the module is auto-installed on every tenant and can't
     * be uninstalled. Reserved for the framework's "core" pseudo-module
     * (members, audit, options). The Finances module is `builtin:
     * false` — auto-installed by the one-shot migration on existing
     * tenants, but uninstallable by future tenants.
     */
    builtin: boolean;
    pages: ModulePage[];
    /**
     * What happens when the module is uninstalled?
     *   - 'archive' — the data stays, the pages disappear (default,
     *     safe for most modules).
     *   - 'forbid' — uninstall is not allowed (used by core).
     *   - 'destroy' — explicit confirmation gate; events stay in
     *     the log but the read-model projections get rebuilt
     *     without this module's data.
     */
    uninstallPolicy: 'archive' | 'forbid' | 'destroy';
    /** Domain names this module owns (for audit / projection scoping). */
    ownedDomains: string[];
}
