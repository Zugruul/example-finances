import type { SorcUUID } from '@event-sorcerer/core';
import type {
    ClientCreatedEvent,
    ClientUpdatedEvent,
    ClientArchivedEvent,
} from './client.events';

/**
 * `clientsByTenant` read model — keyed by `clientId`. Tenant scoping
 * is enforced at the query layer (every read filters by `tenantId`).
 *
 * Note: the PII fields stored here (firstName, lastName, email,
 * phone, address, dateOfBirth, notes) come from the decrypted event
 * payload via `afterRetrieval`. The read-model docs themselves are
 * NOT encrypted at rest — the cryptoshredding plugin only encrypts
 * the events. If we want at-rest encryption on the read model too,
 * the projection should re-encrypt before write. For Psychologist
 * Phase 1 we trust the read-model collection access controls (only
 * the app process reads it) and rely on event-level shredding to
 * cover the GDPR "forget me" path: dropping the per-tenant key
 * renders the event log unreadable, and the read model can be
 * cold-rebuilt → empty.
 */
export type ClientDoc = {
    clientId: SorcUUID;
    tenantId: SorcUUID;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    notes?: string;
    createdAt: Date;
    isArchived: boolean;
};

export type ClientsByTenantListenEvents = readonly [
    { readonly name: 'ClientCreated'; readonly version: '*' },
    { readonly name: 'ClientUpdated'; readonly version: '*' },
    { readonly name: 'ClientArchived'; readonly version: '*' },
];

export const clientsByTenantListen: ClientsByTenantListenEvents = [
    { name: 'ClientCreated', version: '*' },
    { name: 'ClientUpdated', version: '*' },
    { name: 'ClientArchived', version: '*' },
] as const;

type ApplyEvent =
    | InstanceType<typeof ClientCreatedEvent>
    | InstanceType<typeof ClientUpdatedEvent>
    | InstanceType<typeof ClientArchivedEvent>;

export function clientsByTenantKey(
    event: ApplyEvent,
): { clientId: SorcUUID } {
    return { clientId: event.payload.clientId };
}

export function clientsByTenantApply(
    state: ClientDoc | null,
    event: ApplyEvent,
): ClientDoc | null {
    switch (event.name) {
        case 'ClientCreated': {
            const p = event.payload;
            return {
                clientId: p.clientId,
                tenantId: p.tenantId,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
                phone: p.phone,
                address: p.address,
                dateOfBirth: p.dateOfBirth,
                notes: p.notes,
                createdAt: p.createdAt,
                isArchived: false,
            };
        }
        case 'ClientUpdated': {
            if (!state) return state;
            const p = event.payload;
            return {
                ...state,
                firstName:
                    p.firstName !== undefined ? p.firstName : state.firstName,
                lastName:
                    p.lastName !== undefined ? p.lastName : state.lastName,
                email: p.email !== undefined ? p.email : state.email,
                phone: p.phone !== undefined ? p.phone : state.phone,
                address: p.address !== undefined ? p.address : state.address,
                dateOfBirth:
                    p.dateOfBirth !== undefined
                        ? p.dateOfBirth
                        : state.dateOfBirth,
                notes: p.notes !== undefined ? p.notes : state.notes,
            };
        }
        case 'ClientArchived':
            return state ? { ...state, isArchived: true } : state;
        default:
            return state;
    }
}
