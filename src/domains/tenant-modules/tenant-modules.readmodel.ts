import type { SorcUUID } from '@event-sorcerer/core';
import type {
    ModuleInstalledEvent,
    ModuleEnabledEvent,
    ModuleDisabledEvent,
    ModuleUninstalledEvent,
} from './tenant-module.events';

/**
 * `tenantModules` — one doc per (tenant, module) install record.
 * Sparse: an uninstalled record is removed from the read model.
 * The event log keeps the full history. Queried by the sidebar and
 * the route guard to decide which module pages are reachable.
 */
export type TenantModuleDoc = {
    aggregateKey: string; // `${tenantId}|${moduleId}`
    tenantId: SorcUUID;
    moduleId: string;
    status: 'installed' | 'disabled';
    version: string;
    installedAt: Date;
    installedByUserId: SorcUUID;
    lastChangedAt: Date;
};

export type TenantModulesListenEvents = readonly [
    { readonly name: 'ModuleInstalled'; readonly version: '*' },
    { readonly name: 'ModuleEnabled'; readonly version: '*' },
    { readonly name: 'ModuleDisabled'; readonly version: '*' },
    { readonly name: 'ModuleUninstalled'; readonly version: '*' },
];

export const tenantModulesListen: TenantModulesListenEvents = [
    { name: 'ModuleInstalled', version: '*' },
    { name: 'ModuleEnabled', version: '*' },
    { name: 'ModuleDisabled', version: '*' },
    { name: 'ModuleUninstalled', version: '*' },
] as const;

type TenantModulesApplyEvent =
    | InstanceType<typeof ModuleInstalledEvent>
    | InstanceType<typeof ModuleEnabledEvent>
    | InstanceType<typeof ModuleDisabledEvent>
    | InstanceType<typeof ModuleUninstalledEvent>;

export function tenantModulesKey(
    event: TenantModulesApplyEvent,
): { aggregateKey: string } {
    return {
        aggregateKey: `${String(event.payload.tenantId)}|${event.payload.moduleId}`,
    };
}

export function tenantModulesApply(
    state: TenantModuleDoc | null,
    event: TenantModulesApplyEvent,
): TenantModuleDoc | null {
    switch (event.name) {
        case 'ModuleInstalled': {
            const p = event.payload;
            return {
                aggregateKey: `${String(p.tenantId)}|${p.moduleId}`,
                tenantId: p.tenantId,
                moduleId: p.moduleId,
                status: 'installed',
                version: p.version,
                installedAt: p.installedAt,
                installedByUserId: p.installedByUserId,
                lastChangedAt: p.installedAt,
            };
        }
        case 'ModuleEnabled':
            return state
                ? {
                      ...state,
                      status: 'installed',
                      lastChangedAt: event.payload.changedAt,
                  }
                : state;
        case 'ModuleDisabled':
            return state
                ? {
                      ...state,
                      status: 'disabled',
                      lastChangedAt: event.payload.changedAt,
                  }
                : state;
        case 'ModuleUninstalled':
            // Returning null deletes the doc from the read model.
            return null;
        default:
            return state;
    }
}
