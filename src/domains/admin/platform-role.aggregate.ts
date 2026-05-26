import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    AdminGrantedEvent,
    AdminRemovedEvent,
    type PlatformRoleStreamInstance,
} from './admin.events';

export type PlatformRole = 'admin' | 'user';

export type PlatformRoleState = {
    userId: SorcUUID;
    role: PlatformRole;
    grantedBy?: SorcUUID;
    grantedAt?: Date;
    lastChangedAt?: Date;
} | null;

export type PlatformRoleEvent = InstanceType<
    typeof AdminGrantedEvent | typeof AdminRemovedEvent
>;

export function platformRoleReducer(
    state: PlatformRoleState,
    event: PlatformRoleEvent,
): PlatformRoleState {
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

// ----- command inputs -----

export type GrantAdminCmd = {
    targetUserId: SorcUUID;
    grantedByUserId: SorcUUID;
    reason?: string;
    stream: PlatformRoleStreamInstance;
};

export type RemoveAdminCmd = {
    targetUserId: SorcUUID;
    removedByUserId: SorcUUID;
    reason?: string;
    stream: PlatformRoleStreamInstance;
};

// ----- commands -----

export const platformRoleCommands = {
    grantAdmin(
        state: PlatformRoleState,
        cmd: GrantAdminCmd,
        ctx?: CommandContext,
    ): void {
        if (state?.role === 'admin') {
            console.info(
                `[platform-role] grantAdmin no-op: ${cmd.targetUserId} is already admin.`,
            );
            return;
        }
        ctx!.emit(
            AdminGrantedEvent,
            {
                userId: cmd.targetUserId,
                grantedByUserId: cmd.grantedByUserId,
                grantedAt: new Date(),
                reason: cmd.reason,
            } as InstanceType<typeof AdminGrantedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    removeAdmin(
        state: PlatformRoleState,
        cmd: RemoveAdminCmd,
        ctx?: CommandContext,
    ): void {
        if (!state || state.role !== 'admin') {
            console.info(
                `[platform-role] removeAdmin no-op: ${cmd.targetUserId} is not admin.`,
            );
            return;
        }
        ctx!.emit(
            AdminRemovedEvent,
            {
                userId: cmd.targetUserId,
                removedByUserId: cmd.removedByUserId,
                removedAt: new Date(),
                reason: cmd.reason,
            } as InstanceType<typeof AdminRemovedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
