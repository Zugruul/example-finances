import type { SorcUUID } from '@event-sorcerer/core';
import {
    type AdminGrantedEvent,
    type AdminRemovedEvent,
} from './admin.events';

/**
 * `platform-roles` read model — one doc per user, keyed by `userId`.
 * Stores the current platform-level role plus light audit info. The
 * session callback in `src/auth.ts` reads this on every request, so the
 * find-by-userId path needs to stay fast (Mongo index lands in Wave B).
 */
export type PlatformRoleDoc = {
    userId: SorcUUID;
    role: 'admin' | 'user';
    grantedBy?: SorcUUID;
    grantedAt?: Date;
    lastChangedAt: Date;
};

export type PlatformRolesListenEvents = readonly [
    { readonly name: 'AdminGranted'; readonly version: '*' },
    { readonly name: 'AdminRemoved'; readonly version: '*' },
];

export const platformRolesListen: PlatformRolesListenEvents = [
    { name: 'AdminGranted', version: '*' },
    { name: 'AdminRemoved', version: '*' },
] as const;

type PlatformRolesApplyEvent =
    | InstanceType<typeof AdminGrantedEvent>
    | InstanceType<typeof AdminRemovedEvent>;

export function platformRolesKey(event: PlatformRolesApplyEvent) {
    return { userId: event.payload.userId };
}

export function platformRolesApply(
    state: PlatformRoleDoc | null,
    event: PlatformRolesApplyEvent,
): PlatformRoleDoc | null {
    switch (event.name) {
        case 'AdminGranted':
            return {
                userId: event.payload.userId,
                role: 'admin',
                grantedBy: event.payload.grantedByUserId,
                grantedAt: event.payload.grantedAt,
                lastChangedAt: event.payload.grantedAt,
            };
        case 'AdminRemoved':
            return {
                userId: event.payload.userId,
                role: 'user',
                grantedBy: undefined,
                grantedAt: undefined,
                lastChangedAt: event.payload.removedAt,
            };
        default:
            return state;
    }
}
