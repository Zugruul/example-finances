import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    ModuleInstalledEvent,
    ModuleEnabledEvent,
    ModuleDisabledEvent,
    ModuleUninstalledEvent,
    type TenantModuleStreamInstance,
} from './tenant-module.events';

/**
 * Aggregate state: a single (tenant, module) install record. `null`
 * before first install or after uninstall.
 */
export type TenantModuleState = null | {
    tenantId: SorcUUID;
    moduleId: string;
    version: string;
    status: 'installed' | 'disabled';
    installedAt: Date;
    installedByUserId: SorcUUID;
};

export type TenantModuleEvent = InstanceType<
    | typeof ModuleInstalledEvent
    | typeof ModuleEnabledEvent
    | typeof ModuleDisabledEvent
    | typeof ModuleUninstalledEvent
>;

export function tenantModuleReducer(
    state: TenantModuleState,
    event: TenantModuleEvent,
): TenantModuleState {
    switch (event.name) {
        case 'ModuleInstalled':
            return {
                tenantId: event.payload.tenantId,
                moduleId: event.payload.moduleId,
                version: event.payload.version,
                status: 'installed',
                installedAt: event.payload.installedAt,
                installedByUserId: event.payload.installedByUserId,
            };
        case 'ModuleEnabled':
            return state ? { ...state, status: 'installed' } : state;
        case 'ModuleDisabled':
            return state ? { ...state, status: 'disabled' } : state;
        case 'ModuleUninstalled':
            return null;
        default:
            return state;
    }
}

export type InstallModuleCmd = {
    tenantId: SorcUUID;
    moduleId: string;
    version: string;
    installedByUserId: SorcUUID;
    stream: TenantModuleStreamInstance;
};

export type EnableModuleCmd = {
    tenantId: SorcUUID;
    moduleId: string;
    changedByUserId: SorcUUID;
    stream: TenantModuleStreamInstance;
};

export type DisableModuleCmd = EnableModuleCmd;

export type UninstallModuleCmd = {
    tenantId: SorcUUID;
    moduleId: string;
    removedByUserId: SorcUUID;
    reason?: string;
    stream: TenantModuleStreamInstance;
};

export const tenantModuleCommands = {
    installModule(
        state: TenantModuleState,
        cmd: InstallModuleCmd,
        ctx?: CommandContext,
    ): void {
        if (state) {
            // Idempotent: re-installing an already-installed module is
            // a no-op. The migration script can re-run safely.
            return;
        }
        ctx!.emit(
            ModuleInstalledEvent,
            {
                tenantId: cmd.tenantId,
                moduleId: cmd.moduleId,
                version: cmd.version,
                installedByUserId: cmd.installedByUserId,
                installedAt: new Date(),
            } as InstanceType<typeof ModuleInstalledEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    enableModule(
        state: TenantModuleState,
        cmd: EnableModuleCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) {
            throw new Error(
                `Module ${cmd.moduleId} is not installed on this tenant.`,
            );
        }
        if (state.status === 'installed') return; // already enabled
        ctx!.emit(
            ModuleEnabledEvent,
            {
                tenantId: cmd.tenantId,
                moduleId: cmd.moduleId,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
            } as InstanceType<typeof ModuleEnabledEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    disableModule(
        state: TenantModuleState,
        cmd: DisableModuleCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) {
            throw new Error(
                `Module ${cmd.moduleId} is not installed on this tenant.`,
            );
        }
        if (state.status === 'disabled') return;
        ctx!.emit(
            ModuleDisabledEvent,
            {
                tenantId: cmd.tenantId,
                moduleId: cmd.moduleId,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
            } as InstanceType<typeof ModuleDisabledEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    uninstallModule(
        state: TenantModuleState,
        cmd: UninstallModuleCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) return; // already uninstalled
        ctx!.emit(
            ModuleUninstalledEvent,
            {
                tenantId: cmd.tenantId,
                moduleId: cmd.moduleId,
                removedByUserId: cmd.removedByUserId,
                removedAt: new Date(),
                reason: cmd.reason,
            } as InstanceType<typeof ModuleUninstalledEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
