import type { SorcUUID } from '@event-sorcerer/core';
import {
    type UserCreatedEvent,
    type UserProfileUpdatedEvent,
    type UserDeletedEvent,
} from './user.events';

/**
 * `usersById` — per-user profile keyed by `userId`. PII fields surface
 * decrypted when the cryptoshredding key for the user is present; once
 * the user is deleted (key shredded), the plugin substitutes the
 * configured `shreddedPlaceholder` (default `[CRYPTO_SHREDDED]`). We
 * accept that as-is here — the UI / consumers decide how to render
 * shredded entries.
 */
export type UserByIdDoc = {
    userId: SorcUUID;
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
    createdAt: Date;
    updatedAt?: Date;
    deletedAt?: Date;
};

export type UsersByIdListenEvents = readonly [
    { readonly name: 'UserCreated'; readonly version: '*' },
    { readonly name: 'UserProfileUpdated'; readonly version: '*' },
    { readonly name: 'UserDeleted'; readonly version: '*' },
];

export const usersByIdListen: UsersByIdListenEvents = [
    { name: 'UserCreated', version: '*' },
    { name: 'UserProfileUpdated', version: '*' },
    { name: 'UserDeleted', version: '*' },
] as const;

type UsersApplyEvent =
    | InstanceType<typeof UserCreatedEvent>
    | InstanceType<typeof UserProfileUpdatedEvent>
    | InstanceType<typeof UserDeletedEvent>;

export function usersByIdKey(event: UsersApplyEvent) {
    return { userId: event.payload.userId };
}

export function usersByIdApply(
    state: UserByIdDoc | null,
    event: UsersApplyEvent,
): UserByIdDoc | null {
    switch (event.name) {
        case 'UserCreated':
            return {
                userId: event.payload.userId,
                email: event.payload.email,
                createdAt: event.payload.createdAt,
            };
        case 'UserProfileUpdated':
            if (!state) return state;
            return {
                ...state,
                firstName: event.payload.firstName ?? state.firstName,
                lastName: event.payload.lastName ?? state.lastName,
                phoneNumber: event.payload.phoneNumber ?? state.phoneNumber,
                address: event.payload.address ?? state.address,
                updatedAt: event.payload.updatedAt,
            };
        case 'UserDeleted':
            return state
                ? { ...state, deletedAt: event.payload.deletedAt }
                : state;
        default:
            return state;
    }
}
