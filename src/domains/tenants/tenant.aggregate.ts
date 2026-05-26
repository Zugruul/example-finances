import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    TenantCreatedEvent,
    TenantRenamedEvent,
    TenantArchivedEvent,
    type TenantStreamInstance,
} from './tenant.events';

export type TenantState = null | {
    tenantId: SorcUUID;
    displayName: string;
    description?: string;
    createdByUserId: SorcUUID;
    createdAt: Date;
    archivedAt?: Date;
};

export type TenantEvent = InstanceType<
    | typeof TenantCreatedEvent
    | typeof TenantRenamedEvent
    | typeof TenantArchivedEvent
>;

export function tenantReducer(
    state: TenantState,
    event: TenantEvent,
): TenantState {
    switch (event.name) {
        case 'TenantCreated':
            return {
                tenantId: event.payload.tenantId,
                displayName: event.payload.displayName,
                description: event.payload.description,
                createdByUserId: event.payload.createdByUserId,
                createdAt: event.payload.createdAt,
            };
        case 'TenantRenamed':
            return state
                ? { ...state, displayName: event.payload.displayName }
                : state;
        case 'TenantArchived':
            return state
                ? { ...state, archivedAt: event.payload.archivedAt }
                : state;
        default:
            return state;
    }
}

// ----- command inputs -----

export type CreateTenantCmd = {
    tenantId: SorcUUID;
    displayName: string;
    description?: string;
    createdByUserId: SorcUUID;
    stream: TenantStreamInstance;
};

export type RenameTenantCmd = {
    displayName: string;
    renamedByUserId: SorcUUID;
    stream: TenantStreamInstance;
};

export type ArchiveTenantCmd = {
    archivedByUserId: SorcUUID;
    stream: TenantStreamInstance;
};

// ----- commands -----
// NOTE: handlers use OPTIONAL `ctx?` so type inference works (see retired
// example-general's Wave-D re-dispatch decision: required ctx collapses
// the Commands generic to `Record<string, never>`).

export const tenantCommands = {
    createTenant(
        state: TenantState,
        cmd: CreateTenantCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(`Tenant ${cmd.tenantId} already exists`);
        ctx!.emit(
            TenantCreatedEvent,
            {
                tenantId: cmd.tenantId,
                displayName: cmd.displayName,
                description: cmd.description,
                createdByUserId: cmd.createdByUserId,
                createdAt: new Date(),
            } as InstanceType<typeof TenantCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    renameTenant(
        state: TenantState,
        cmd: RenameTenantCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Tenant does not exist');
        if (state.archivedAt) throw new Error('Tenant is archived');
        ctx!.emit(
            TenantRenamedEvent,
            {
                tenantId: state.tenantId,
                displayName: cmd.displayName,
                renamedByUserId: cmd.renamedByUserId,
                renamedAt: new Date(),
            } as InstanceType<typeof TenantRenamedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    archiveTenant(
        state: TenantState,
        cmd: ArchiveTenantCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Tenant does not exist');
        if (state.archivedAt) throw new Error('Tenant already archived');
        ctx!.emit(
            TenantArchivedEvent,
            {
                tenantId: state.tenantId,
                archivedByUserId: cmd.archivedByUserId,
                archivedAt: new Date(),
            } as InstanceType<typeof TenantArchivedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
