import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    PsychologistSessionScheduledEvent,
    PsychologistSessionRescheduledEvent,
    PsychologistSessionStatusChangedEvent,
    type PsychologistSessionStreamInstance,
    type PsychologistSessionModality,
    type PsychologistSessionStatus,
} from './session.events';

export type PsychologistSessionState = null | {
    sessionId: SorcUUID;
    tenantId: SorcUUID;
    clientId: SorcUUID;
    startsAt: Date;
    durationMinutes: number;
    modality: PsychologistSessionModality;
    telehealthMeetingId?: SorcUUID;
    locationLabel?: string;
    status: PsychologistSessionStatus;
};

export type PsychologistSessionEvent = InstanceType<
    | typeof PsychologistSessionScheduledEvent
    | typeof PsychologistSessionRescheduledEvent
    | typeof PsychologistSessionStatusChangedEvent
>;

export function psychologistSessionReducer(
    state: PsychologistSessionState,
    event: PsychologistSessionEvent,
): PsychologistSessionState {
    switch (event.name) {
        case 'PsychologistSessionScheduled': {
            const p = event.payload;
            return {
                sessionId: p.sessionId,
                tenantId: p.tenantId,
                clientId: p.clientId,
                startsAt: p.startsAt,
                durationMinutes: p.durationMinutes,
                modality: p.modality,
                telehealthMeetingId: p.telehealthMeetingId,
                locationLabel: p.locationLabel,
                status: 'scheduled',
            };
        }
        case 'PsychologistSessionRescheduled':
            return state
                ? {
                      ...state,
                      startsAt: event.payload.startsAt,
                      durationMinutes: event.payload.durationMinutes,
                  }
                : state;
        case 'PsychologistSessionStatusChanged':
            return state
                ? { ...state, status: event.payload.status }
                : state;
        default:
            return state;
    }
}

export type SchedulePsychologistSessionCmd = {
    sessionId: SorcUUID;
    tenantId: SorcUUID;
    clientId: SorcUUID;
    startsAt: Date;
    durationMinutes: number;
    modality: PsychologistSessionModality;
    telehealthMeetingId?: SorcUUID;
    locationLabel?: string;
    scheduledByUserId: SorcUUID;
    stream: PsychologistSessionStreamInstance;
};

export type ReschedulePsychologistSessionCmd = {
    tenantId: SorcUUID;
    startsAt: Date;
    durationMinutes: number;
    rescheduledByUserId: SorcUUID;
    reason?: string;
    stream: PsychologistSessionStreamInstance;
};

export type ChangePsychologistSessionStatusCmd = {
    tenantId: SorcUUID;
    status: PsychologistSessionStatus;
    changedByUserId: SorcUUID;
    reason?: string;
    stream: PsychologistSessionStreamInstance;
};

export const psychologistSessionCommands = {
    schedulePsychologistSession(
        state: PsychologistSessionState,
        cmd: SchedulePsychologistSessionCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(`Session ${cmd.sessionId} already exists`);
        if (cmd.durationMinutes <= 0) {
            throw new Error('Duration must be positive.');
        }
        ctx!.emit(
            PsychologistSessionScheduledEvent,
            {
                sessionId: cmd.sessionId,
                tenantId: cmd.tenantId,
                clientId: cmd.clientId,
                startsAt: cmd.startsAt,
                durationMinutes: cmd.durationMinutes,
                modality: cmd.modality,
                telehealthMeetingId: cmd.telehealthMeetingId,
                locationLabel: cmd.locationLabel,
                scheduledByUserId: cmd.scheduledByUserId,
                scheduledAt: new Date(),
            } as InstanceType<
                typeof PsychologistSessionScheduledEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    reschedulePsychologistSession(
        state: PsychologistSessionState,
        cmd: ReschedulePsychologistSessionCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Session does not exist');
        if (state.status === 'cancelled') {
            throw new Error(
                'Cannot reschedule a cancelled session; create a new one.',
            );
        }
        ctx!.emit(
            PsychologistSessionRescheduledEvent,
            {
                sessionId: state.sessionId,
                tenantId: state.tenantId,
                startsAt: cmd.startsAt,
                durationMinutes: cmd.durationMinutes,
                rescheduledByUserId: cmd.rescheduledByUserId,
                rescheduledAt: new Date(),
                reason: cmd.reason,
            } as InstanceType<
                typeof PsychologistSessionRescheduledEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    changePsychologistSessionStatus(
        state: PsychologistSessionState,
        cmd: ChangePsychologistSessionStatusCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Session does not exist');
        if (state.status === cmd.status) return;
        ctx!.emit(
            PsychologistSessionStatusChangedEvent,
            {
                sessionId: state.sessionId,
                tenantId: state.tenantId,
                status: cmd.status,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
                reason: cmd.reason,
            } as InstanceType<
                typeof PsychologistSessionStatusChangedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
};
