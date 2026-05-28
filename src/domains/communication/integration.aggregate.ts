import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    CommunicationIntegrationConnectedEvent,
    CommunicationIntegrationUpdatedEvent,
    CommunicationIntegrationDisabledEvent,
    CommunicationIntegrationEnabledEvent,
    CommunicationIntegrationRemovedEvent,
    type CommunicationIntegrationStreamInstance,
    type CommunicationProvider,
} from './integration.events';

export type CommunicationIntegrationState = null | {
    integrationId: SorcUUID;
    tenantId: SorcUUID;
    provider: CommunicationProvider;
    config: string; // JSON
    label: string;
    status: 'enabled' | 'disabled';
};

export type CommunicationIntegrationEvent = InstanceType<
    | typeof CommunicationIntegrationConnectedEvent
    | typeof CommunicationIntegrationUpdatedEvent
    | typeof CommunicationIntegrationDisabledEvent
    | typeof CommunicationIntegrationEnabledEvent
    | typeof CommunicationIntegrationRemovedEvent
>;

export function communicationIntegrationReducer(
    state: CommunicationIntegrationState,
    event: CommunicationIntegrationEvent,
): CommunicationIntegrationState {
    switch (event.name) {
        case 'CommunicationIntegrationConnected': {
            const p = event.payload;
            return {
                integrationId: p.integrationId,
                tenantId: p.tenantId,
                provider: p.provider,
                config: p.config,
                label: p.label,
                status: 'enabled',
            };
        }
        case 'CommunicationIntegrationUpdated':
            if (!state) return state;
            return {
                ...state,
                config:
                    event.payload.config !== undefined
                        ? event.payload.config
                        : state.config,
                label:
                    event.payload.label !== undefined
                        ? event.payload.label
                        : state.label,
            };
        case 'CommunicationIntegrationDisabled':
            return state ? { ...state, status: 'disabled' } : state;
        case 'CommunicationIntegrationEnabled':
            return state ? { ...state, status: 'enabled' } : state;
        case 'CommunicationIntegrationRemoved':
            return null;
        default:
            return state;
    }
}

export type ConnectCommunicationIntegrationCmd = {
    integrationId: SorcUUID;
    tenantId: SorcUUID;
    provider: CommunicationProvider;
    config: string;
    label: string;
    connectedByUserId: SorcUUID;
    stream: CommunicationIntegrationStreamInstance;
};

export type UpdateCommunicationIntegrationCmd = {
    tenantId: SorcUUID;
    config?: string;
    label?: string;
    updatedByUserId: SorcUUID;
    stream: CommunicationIntegrationStreamInstance;
};

export type DisableCommunicationIntegrationCmd = {
    tenantId: SorcUUID;
    changedByUserId: SorcUUID;
    stream: CommunicationIntegrationStreamInstance;
};

export type EnableCommunicationIntegrationCmd = DisableCommunicationIntegrationCmd;

export type RemoveCommunicationIntegrationCmd = {
    tenantId: SorcUUID;
    removedByUserId: SorcUUID;
    stream: CommunicationIntegrationStreamInstance;
};

export const communicationIntegrationCommands = {
    connectCommunicationIntegration(
        state: CommunicationIntegrationState,
        cmd: ConnectCommunicationIntegrationCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(
                `Integration ${cmd.integrationId} already exists`,
            );
        ctx!.emit(
            CommunicationIntegrationConnectedEvent,
            {
                integrationId: cmd.integrationId,
                tenantId: cmd.tenantId,
                provider: cmd.provider,
                config: cmd.config,
                label: cmd.label,
                connectedByUserId: cmd.connectedByUserId,
                connectedAt: new Date(),
            } as InstanceType<
                typeof CommunicationIntegrationConnectedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    updateCommunicationIntegration(
        state: CommunicationIntegrationState,
        cmd: UpdateCommunicationIntegrationCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Integration does not exist');
        ctx!.emit(
            CommunicationIntegrationUpdatedEvent,
            {
                integrationId: state.integrationId,
                tenantId: state.tenantId,
                config: cmd.config,
                label: cmd.label,
                updatedByUserId: cmd.updatedByUserId,
                updatedAt: new Date(),
            } as InstanceType<
                typeof CommunicationIntegrationUpdatedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    disableCommunicationIntegration(
        state: CommunicationIntegrationState,
        cmd: DisableCommunicationIntegrationCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Integration does not exist');
        if (state.status === 'disabled') return;
        ctx!.emit(
            CommunicationIntegrationDisabledEvent,
            {
                integrationId: state.integrationId,
                tenantId: state.tenantId,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
            } as InstanceType<
                typeof CommunicationIntegrationDisabledEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    enableCommunicationIntegration(
        state: CommunicationIntegrationState,
        cmd: EnableCommunicationIntegrationCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Integration does not exist');
        if (state.status === 'enabled') return;
        ctx!.emit(
            CommunicationIntegrationEnabledEvent,
            {
                integrationId: state.integrationId,
                tenantId: state.tenantId,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
            } as InstanceType<
                typeof CommunicationIntegrationEnabledEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    removeCommunicationIntegration(
        state: CommunicationIntegrationState,
        cmd: RemoveCommunicationIntegrationCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) return;
        ctx!.emit(
            CommunicationIntegrationRemovedEvent,
            {
                integrationId: state.integrationId,
                tenantId: state.tenantId,
                removedByUserId: cmd.removedByUserId,
                removedAt: new Date(),
            } as InstanceType<
                typeof CommunicationIntegrationRemovedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
};
