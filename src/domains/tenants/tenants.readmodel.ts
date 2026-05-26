import type { SorcUUID } from '@event-sorcerer/core';
import {
    type MemberInvitedEvent,
    type InvitationAcceptedEvent,
    type MemberRoleChangedEvent,
    type MemberRemovedEvent,
} from './membership.events';

/**
 * Per-membership read model. The dispatch asked for "per-user list" but
 * Wave A uses an in-memory store and `MemberRoleChanged`/`MemberRemoved`
 * events don't carry the userId. Keying by `membershipId` makes the
 * read-model trivially correct; the UI filters by `userId` at query time
 * via `find({ userId })`. Wave B can swap in a Mongo store with a
 * secondary index on `userId` if filtering becomes a hotspot.
 */
export type MembershipDoc = {
    tenantId: SorcUUID;
    membershipId: SorcUUID;
    invitedEmail: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    invitedByUserId: SorcUUID;
    invitedAt: Date;
    /** Populated after InvitationAccepted. */
    userId?: SorcUUID;
    displayName?: string;
    joinedAt?: Date;
    /**
     * Populated after MemberRemoved — keeps the doc for audit. Epoch-ms
     * (post-F.B.member-timestamps).
     */
    removedAt?: number;
};

export type MembershipsListenEvents = readonly [
    { readonly name: 'MemberInvited'; readonly version: '*' },
    { readonly name: 'InvitationAccepted'; readonly version: '*' },
    { readonly name: 'MemberRoleChanged'; readonly version: '*' },
    { readonly name: 'MemberRemoved'; readonly version: '*' },
];

export const membershipsListen: MembershipsListenEvents = [
    { name: 'MemberInvited', version: '*' },
    { name: 'InvitationAccepted', version: '*' },
    { name: 'MemberRoleChanged', version: '*' },
    { name: 'MemberRemoved', version: '*' },
] as const;

type MembershipApplyEvent =
    | InstanceType<typeof MemberInvitedEvent>
    | InstanceType<typeof InvitationAcceptedEvent>
    | InstanceType<typeof MemberRoleChangedEvent>
    | InstanceType<typeof MemberRemovedEvent>;

export function membershipsKey(event: MembershipApplyEvent) {
    return { membershipId: event.payload.membershipId };
}

export function membershipsApply(
    state: MembershipDoc | null,
    event: MembershipApplyEvent,
): MembershipDoc | null {
    switch (event.name) {
        case 'MemberInvited':
            return {
                tenantId: event.payload.tenantId,
                membershipId: event.payload.membershipId,
                invitedEmail: event.payload.invitedEmail,
                role: event.payload.role,
                invitedByUserId: event.payload.invitedByUserId,
                invitedAt: event.payload.invitedAt,
            };
        case 'InvitationAccepted':
            return state
                ? {
                      ...state,
                      userId: event.payload.userId,
                      displayName: event.payload.displayName,
                      joinedAt: event.payload.acceptedAt,
                  }
                : state;
        case 'MemberRoleChanged':
            return state ? { ...state, role: event.payload.role } : state;
        case 'MemberRemoved':
            return state
                ? { ...state, removedAt: event.payload.removedAt }
                : state;
        default:
            return state;
    }
}
