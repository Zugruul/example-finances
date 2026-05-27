import type { SorcUUID } from '@event-sorcerer/core';
import {
    type AccountCreatedEvent,
    type AccountRenamedEvent,
    type AccountTypeChangedEvent,
    type AccountArchivedEvent,
    type AccountClosedEvent,
    type AccountType,
} from './account.events';

export type AccountDoc = {
    accountId: SorcUUID;
    tenantId: SorcUUID;
    name: string;
    accountType: AccountType;
    currency: string;
    openingBalance: number;
    createdByUserId: SorcUUID;
    createdAt: Date;
    isArchived: boolean;
    isClosed: boolean;
};

export type AccountsByTenantListenEvents = readonly [
    { readonly name: 'AccountCreated'; readonly version: '*' },
    { readonly name: 'AccountRenamed'; readonly version: '*' },
    { readonly name: 'AccountTypeChanged'; readonly version: '*' },
    { readonly name: 'AccountArchived'; readonly version: '*' },
    { readonly name: 'AccountClosed'; readonly version: '*' },
];

export const accountsByTenantListen: AccountsByTenantListenEvents = [
    { name: 'AccountCreated', version: '*' },
    { name: 'AccountRenamed', version: '*' },
    { name: 'AccountTypeChanged', version: '*' },
    { name: 'AccountArchived', version: '*' },
    { name: 'AccountClosed', version: '*' },
] as const;

type AccountsApplyEvent =
    | InstanceType<typeof AccountCreatedEvent>
    | InstanceType<typeof AccountRenamedEvent>
    | InstanceType<typeof AccountTypeChangedEvent>
    | InstanceType<typeof AccountArchivedEvent>
    | InstanceType<typeof AccountClosedEvent>;

export function accountsByTenantKey(event: AccountsApplyEvent) {
    return { accountId: event.payload.accountId };
}

export function accountsByTenantApply(
    state: AccountDoc | null,
    event: AccountsApplyEvent,
): AccountDoc | null {
    switch (event.name) {
        case 'AccountCreated':
            return {
                accountId: event.payload.accountId,
                tenantId: event.payload.tenantId,
                name: event.payload.name,
                accountType: event.payload.accountType,
                currency: event.payload.currency,
                openingBalance: event.payload.openingBalance,
                createdByUserId: event.payload.createdByUserId,
                createdAt: event.payload.createdAt,
                isArchived: false,
                isClosed: false,
            };
        case 'AccountRenamed':
            return state ? { ...state, name: event.payload.name } : state;
        case 'AccountTypeChanged':
            return state
                ? { ...state, accountType: event.payload.accountType }
                : state;
        case 'AccountArchived':
            return state ? { ...state, isArchived: true } : state;
        case 'AccountClosed':
            return state ? { ...state, isClosed: true } : state;
        default:
            return state;
    }
}
