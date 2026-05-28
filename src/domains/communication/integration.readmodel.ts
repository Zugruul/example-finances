import type { SorcUUID } from '@event-sorcerer/core';
import type {
    CommunicationIntegrationConnectedEvent,
    CommunicationIntegrationUpdatedEvent,
    CommunicationIntegrationDisabledEvent,
    CommunicationIntegrationEnabledEvent,
    CommunicationIntegrationRemovedEvent,
    CommunicationProvider,
} from './integration.events';

/**
 * IMPORTANT: this doc deliberately does NOT carry the `config` blob.
 *
 * The event `CommunicationIntegrationConnected.payload.config` is
 * `@property({ tags: ['pii'] })` and cryptoshredded at the event-log
 * layer. The framework's `afterRetrieval` plugin hook decrypts the
 * payload BEFORE it reaches the read-model subscriber's `apply()`,
 * so if `apply()` wrote `config` into the doc the read-model
 * collection would end up holding plaintext credentials on disk — a
 * much worse exposure than the events (events at rest are
 * unreadable without the key; read-model docs are not).
 *
 * Resolution (cryptoshredding audit 2026-05-28, option 1): the doc
 * holds only the indexable metadata (label, provider, status). The
 * send worker resolves the credential at dispatch time by
 * rehydrating the integration aggregate state from the event log
 * (which routes through `afterRetrieval` → decryption → reducer
 * chain) and reads `state.config` in-memory.
 *
 * Defense-in-depth: an attacker who gets read access to
 * `rm_communication_integrations` sees only label + status — no
 * credentials. They still need access to both the `events`
 * collection AND the per-tenant key store to recover the credential.
 */
export type CommunicationIntegrationDoc = {
    integrationId: SorcUUID;
    tenantId: SorcUUID;
    provider: CommunicationProvider;
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
                label: p.label,
                status: 'enabled',
            };
        }
        case 'CommunicationIntegrationUpdated':
            if (!state) return state;
            return {
                ...state,
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
