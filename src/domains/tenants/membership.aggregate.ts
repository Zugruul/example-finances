import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    MemberInvitedEvent,
    InvitationAcceptedEvent,
    MemberRoleChangedEvent,
    MemberRemovedEvent,
    type MembershipStreamInstance,
    type MembershipRole,
} from './membership.events';

export type MembershipState = null | {
    tenantId: SorcUUID;
    membershipId: SorcUUID;
    invitedEmail: string;
    role: MembershipRole;
    invitedByUserId: SorcUUID;
    invitedAt: Date;
    userId?: SorcUUID;
    displayName?: string;
    acceptedAt?: Date;
    /** Epoch-ms (post-F.B.member-timestamps). */
    removedAt?: number;
};

export type MembershipEvent = InstanceType<
    | typeof MemberInvitedEvent
    | typeof InvitationAcceptedEvent
    | typeof MemberRoleChangedEvent
    | typeof MemberRemovedEvent
>;

export function membershipReducer(
    state: MembershipState,
    event: MembershipEvent,
): MembershipState {
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
                      acceptedAt: event.payload.acceptedAt,
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

// ----- command inputs -----

export type InviteMemberCmd = {
    tenantId: SorcUUID;
    membershipId: SorcUUID;
    invitedEmail: string;
    role: MembershipRole;
    invitedByUserId: SorcUUID;
    stream: MembershipStreamInstance;
};

export type AcceptInviteCmd = {
    userId: SorcUUID;
    displayName: string;
    stream: MembershipStreamInstance;
};

export type ChangeRoleCmd = {
    role: MembershipRole;
    changedByUserId: SorcUUID;
    stream: MembershipStreamInstance;
};

export type RemoveMemberCmd = {
    removedByUserId: SorcUUID;
    stream: MembershipStreamInstance;
};

// ----- commands -----

export const membershipCommands = {
    inviteMember(
        state: MembershipState,
        cmd: InviteMemberCmd,
        ctx?: CommandContext,
    ): void {
        if (state) throw new Error('Membership already exists');
        ctx!.emit(
            MemberInvitedEvent,
            {
                tenantId: cmd.tenantId,
                membershipId: cmd.membershipId,
                invitedEmail: cmd.invitedEmail,
                role: cmd.role,
                invitedByUserId: cmd.invitedByUserId,
                invitedAt: new Date(),
            } as InstanceType<typeof MemberInvitedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    acceptInvite(
        state: MembershipState,
        cmd: AcceptInviteCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Membership does not exist');
        if (state.acceptedAt) throw new Error('Invitation already accepted');
        if (state.removedAt) throw new Error('Membership has been removed');
        ctx!.emit(
            InvitationAcceptedEvent,
            {
                tenantId: state.tenantId,
                membershipId: state.membershipId,
                userId: cmd.userId,
                displayName: cmd.displayName,
                acceptedAt: new Date(),
            } as InstanceType<typeof InvitationAcceptedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    changeRole(
        state: MembershipState,
        cmd: ChangeRoleCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Membership does not exist');
        if (state.removedAt) throw new Error('Membership has been removed');
        ctx!.emit(
            MemberRoleChangedEvent,
            {
                tenantId: state.tenantId,
                membershipId: state.membershipId,
                role: cmd.role,
                changedByUserId: cmd.changedByUserId,
                changedAt: Date.now(),
            } as InstanceType<typeof MemberRoleChangedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    removeMember(
        state: MembershipState,
        cmd: RemoveMemberCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Membership does not exist');
        if (state.removedAt) throw new Error('Membership already removed');
        ctx!.emit(
            MemberRemovedEvent,
            {
                tenantId: state.tenantId,
                membershipId: state.membershipId,
                removedByUserId: cmd.removedByUserId,
                removedAt: Date.now(),
            } as InstanceType<typeof MemberRemovedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
