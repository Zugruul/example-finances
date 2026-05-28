import type { SorcUUID } from '@event-sorcerer/core';
import {
    type TenantCreatedEvent,
    type TenantRenamedEvent,
    type TenantArchivedEvent,
    type TenantDefaultCurrencyChangedEvent,
} from './tenant.events';

export type TenantDoc = {
    tenantId: SorcUUID;
    displayName: string;
    description?: string;
    createdByUserId: SorcUUID;
    createdAt: Date;
    archivedAt?: Date;
    defaultCurrency?: string;
};

export type TenantsListenEvents = readonly [
    { readonly name: 'TenantCreated'; readonly version: '*' },
    { readonly name: 'TenantRenamed'; readonly version: '*' },
    { readonly name: 'TenantArchived'; readonly version: '*' },
    { readonly name: 'TenantDefaultCurrencyChanged'; readonly version: '*' },
];

export const tenantsListen: TenantsListenEvents = [
    { name: 'TenantCreated', version: '*' },
    { name: 'TenantRenamed', version: '*' },
    { name: 'TenantArchived', version: '*' },
    { name: 'TenantDefaultCurrencyChanged', version: '*' },
] as const;

type TenantApplyEvent =
    | InstanceType<typeof TenantCreatedEvent>
    | InstanceType<typeof TenantRenamedEvent>
    | InstanceType<typeof TenantArchivedEvent>
    | InstanceType<typeof TenantDefaultCurrencyChangedEvent>;

export function tenantsKey(event: TenantApplyEvent) {
    return { tenantId: event.payload.tenantId };
}

export function tenantsApply(
    state: TenantDoc | null,
    event: TenantApplyEvent,
): TenantDoc | null {
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
        case 'TenantDefaultCurrencyChanged':
            return state
                ? {
                      ...state,
                      defaultCurrency: event.payload.defaultCurrency,
                  }
                : state;
        default:
            return state;
    }
}
