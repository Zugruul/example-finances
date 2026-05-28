import type { SorcUUID } from '@event-sorcerer/core';
import type {
    CommunicationIntegrationConnectedEvent,
    CommunicationIntegrationUpdatedEvent,
    CommunicationIntegrationDisabledEvent,
    CommunicationIntegrationEnabledEvent,
    CommunicationIntegrationRemovedEvent,
    CommunicationProvider,
} from './integration.events';

export type CommunicationIntegrationDoc = {
    integrationId: SorcUUID;
    tenantId: SorcUUID;
    provider: CommunicationProvider;
    config: string; // JSON, cryptoshredded at the event layer
    label: string;
    status: 'enabled' | 'disabled';
};

export type CommunicationIntegrationsListenEvents = readonly [
    {
        readonly name: 'CommunicationIntegrationConnected';
        readonly version: '*';
    },
    {
        readonly name: 'CommunicationIntegrationUpdated';
        readonly version: '*';
    },
    {
        readonly name: 'CommunicationIntegrationDisabled';
        readonly version: '*';
    },
    {
        readonly name: 'CommunicationIntegrationEnabled';
        readonly version: '*';
    },
    {
        readonly name: 'CommunicationIntegrationRemoved';
        readonly version: '*';
    },
];

export const communicationIntegrationsListen: CommunicationIntegrationsListenEvents =
    [
        { name: 'CommunicationIntegrationConnected', version: '*' },
        { name: 'CommunicationIntegrationUpdated', version: '*' },
        { name: 'CommunicationIntegrationDisabled', version: '*' },
        { name: 'CommunicationIntegrationEnabled', version: '*' },
        { name: 'CommunicationIntegrationRemoved', version: '*' },
    ] as const;

type ApplyEvent =
    | InstanceType<typeof CommunicationIntegrationConnectedEvent>
    | InstanceType<typeof CommunicationIntegrationUpdatedEvent>
    | InstanceType<typeof CommunicationIntegrationDisabledEvent>
    | InstanceType<typeof CommunicationIntegrationEnabledEvent>
    | InstanceType<typeof CommunicationIntegrationRemovedEvent>;

export function communicationIntegrationsKey(event: ApplyEvent): {
    integrationId: SorcUUID;
} {
    return { integrationId: event.payload.integrationId };
}

export function communicationIntegrationsApply(
    state: CommunicationIntegrationDoc | null,
    event: ApplyEvent,
): CommunicationIntegrationDoc | null {
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
