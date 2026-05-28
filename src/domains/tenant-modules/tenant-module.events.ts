import {
    SorcBaseEvent,
    SorcStreamInstance,
    SorcStreamPattern,
    SorcPayload,
    SorcUUID,
    domain,
    foreign,
    property,
} from '@event-sorcerer/core';

/**
 * tenant-modules domain. Tracks which modules a tenant has
 * installed and whether each is enabled/disabled. One stream per
 * (tenant, module) pair, written as:
 *
 *   tenant-<tenantId>-modules-<moduleId>
 *
 * Per-stream CAS so concurrent install/enable/disable calls on the
 * same module can't race; cross-module installs on the same tenant
 * are independent.
 */

export type TenantModuleStreamInstance =
    SorcStreamInstance<`tenant-${string}-modules-${string}`>;
export type TenantModuleStreamPattern =
    SorcStreamPattern<`tenant-${string}-modules-${string}`>;

@domain('tenant-modules')
export class ModuleInstalledPayload extends SorcPayload {
    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    moduleId!: string;

    @property({ type: 'string', required: true })
    version!: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    installedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    installedAt!: Date;
}

@domain('tenant-modules')
export class ModuleEnabledPayload extends SorcPayload {
    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    moduleId!: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('tenant-modules')
export class ModuleDisabledPayload extends SorcPayload {
    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    moduleId!: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('tenant-modules')
export class ModuleUninstalledPayload extends SorcPayload {
    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    moduleId!: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    removedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    removedAt!: Date;

    @property({ type: 'string' })
    reason?: string;
}

@domain('tenant-modules')
export class ModuleInstalledEvent extends SorcBaseEvent {
    readonly name = 'ModuleInstalled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantModuleStreamInstance,
        public payload: ModuleInstalledPayload,
    ) {
        super();
    }
}

@domain('tenant-modules')
export class ModuleEnabledEvent extends SorcBaseEvent {
    readonly name = 'ModuleEnabled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantModuleStreamInstance,
        public payload: ModuleEnabledPayload,
    ) {
        super();
    }
}

@domain('tenant-modules')
export class ModuleDisabledEvent extends SorcBaseEvent {
    readonly name = 'ModuleDisabled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantModuleStreamInstance,
        public payload: ModuleDisabledPayload,
    ) {
        super();
    }
}

@domain('tenant-modules')
export class ModuleUninstalledEvent extends SorcBaseEvent {
    readonly name = 'ModuleUninstalled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantModuleStreamInstance,
        public payload: ModuleUninstalledPayload,
    ) {
        super();
    }
}

export const tenantModuleEvents = [
    ModuleInstalledEvent,
    ModuleEnabledEvent,
    ModuleDisabledEvent,
    ModuleUninstalledEvent,
] as const;
