import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    ImpersonationStartedEvent,
    ImpersonationEndedEvent,
    AdminActionTakenEvent,
    type AdminActionsStreamInstance,
} from './admin.events';

/**
 * AdminActions is an append-only audit log per admin user. There is no
 * "state machine" here — the reducer just tracks the last impersonation
 * for sanity-checking that End follows Started. Reads come from the
 * `admin-activity` read model.
 */
export type AdminActionsState = {
    actorAdminId: SorcUUID;
    currentImpersonation?: {
        targetUserId: SorcUUID;
        startedAt: Date;
    };
} | null;

export type AdminActionsEvent = InstanceType<
    | typeof ImpersonationStartedEvent
    | typeof ImpersonationEndedEvent
    | typeof AdminActionTakenEvent
>;

export function adminActionsReducer(
    state: AdminActionsState,
    event: AdminActionsEvent,
): AdminActionsState {
    switch (event.name) {
        case 'ImpersonationStarted':
            return {
                actorAdminId: event.payload.actorAdminId,
                currentImpersonation: {
                    targetUserId: event.payload.targetUserId,
                    startedAt: event.payload.startedAt,
                },
            };
        case 'ImpersonationEnded':
            return state
                ? { ...state, currentImpersonation: undefined }
                : { actorAdminId: event.payload.actorAdminId };
        case 'AdminActionTaken':
            return state ?? { actorAdminId: event.payload.actorAdminId };
        default:
            return state;
    }
}

// ----- command inputs -----

export type StartImpersonationCmd = {
    actorAdminId: SorcUUID;
    targetUserId: SorcUUID;
    targetEmail: string;
    stream: AdminActionsStreamInstance;
};

export type EndImpersonationCmd = {
    actorAdminId: SorcUUID;
    targetUserId: SorcUUID;
    reason?: 'user' | 'expired';
    stream: AdminActionsStreamInstance;
};

export type RecordAdminActionCmd = {
    actorAdminId: SorcUUID;
    action: string;
    note?: string;
    stream: AdminActionsStreamInstance;
};

// ----- commands -----

export const adminCommands = {
    startImpersonation(
        state: AdminActionsState,
        cmd: StartImpersonationCmd,
        ctx?: CommandContext,
    ): void {
        if (state?.currentImpersonation) {
            throw new Error('An impersonation session is already active.');
        }
        ctx!.emit(
            ImpersonationStartedEvent,
            {
                actorAdminId: cmd.actorAdminId,
                targetUserId: cmd.targetUserId,
                targetEmail: cmd.targetEmail,
                startedAt: new Date(),
            } as InstanceType<typeof ImpersonationStartedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    endImpersonation(
        state: AdminActionsState,
        cmd: EndImpersonationCmd,
        ctx?: CommandContext,
    ): void {
        if (!state?.currentImpersonation) {
            throw new Error('No active impersonation to end.');
        }
        ctx!.emit(
            ImpersonationEndedEvent,
            {
                actorAdminId: cmd.actorAdminId,
                targetUserId: cmd.targetUserId,
                endedAt: new Date(),
                reason: cmd.reason ?? 'user',
            } as InstanceType<typeof ImpersonationEndedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    recordAdminAction(
        state: AdminActionsState,
        cmd: RecordAdminActionCmd,
        ctx?: CommandContext,
    ): void {
        ctx!.emit(
            AdminActionTakenEvent,
            {
                actorAdminId: cmd.actorAdminId,
                action: cmd.action,
                note: cmd.note,
                occurredAt: new Date(),
            } as InstanceType<typeof AdminActionTakenEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
