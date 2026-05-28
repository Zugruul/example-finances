import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    TelehealthMeetingScheduledEvent,
    TelehealthMeetingStatusChangedEvent,
    type TelehealthMeetingStreamInstance,
    type TelehealthProvider,
    type TelehealthMeetingStatus,
} from './meeting.events';

export type TelehealthMeetingState = null | {
    meetingId: SorcUUID;
    tenantId: SorcUUID;
    provider: TelehealthProvider;
    joinUrl: string;
    hostKey?: string;
    startsAt: Date;
    durationMinutes: number;
    linkedEntityKind?: string;
    linkedEntityId?: SorcUUID;
    status: TelehealthMeetingStatus;
};

export type TelehealthMeetingEvent = InstanceType<
    | typeof TelehealthMeetingScheduledEvent
    | typeof TelehealthMeetingStatusChangedEvent
>;

export function telehealthMeetingReducer(
    state: TelehealthMeetingState,
    event: TelehealthMeetingEvent,
): TelehealthMeetingState {
    switch (event.name) {
        case 'TelehealthMeetingScheduled': {
            const p = event.payload;
            return {
                meetingId: p.meetingId,
                tenantId: p.tenantId,
                provider: p.provider,
                joinUrl: p.joinUrl,
                hostKey: p.hostKey,
                startsAt: p.startsAt,
                durationMinutes: p.durationMinutes,
                linkedEntityKind: p.linkedEntityKind,
                linkedEntityId: p.linkedEntityId,
                status: 'scheduled',
            };
        }
        case 'TelehealthMeetingStatusChanged':
            return state
                ? { ...state, status: event.payload.status }
                : state;
        default:
            return state;
    }
}

export type ScheduleTelehealthMeetingCmd = {
    meetingId: SorcUUID;
    tenantId: SorcUUID;
    provider: TelehealthProvider;
    joinUrl: string;
    hostKey?: string;
    startsAt: Date;
    durationMinutes: number;
    linkedEntityKind?: string;
    linkedEntityId?: SorcUUID;
    scheduledByUserId: SorcUUID;
    stream: TelehealthMeetingStreamInstance;
};

export type ChangeTelehealthMeetingStatusCmd = {
    tenantId: SorcUUID;
    status: TelehealthMeetingStatus;
    changedByUserId: SorcUUID;
    stream: TelehealthMeetingStreamInstance;
};

export const telehealthMeetingCommands = {
    scheduleTelehealthMeeting(
        state: TelehealthMeetingState,
        cmd: ScheduleTelehealthMeetingCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(`Meeting ${cmd.meetingId} already exists`);
        ctx!.emit(
            TelehealthMeetingScheduledEvent,
            {
                meetingId: cmd.meetingId,
                tenantId: cmd.tenantId,
                provider: cmd.provider,
                joinUrl: cmd.joinUrl,
                hostKey: cmd.hostKey,
                startsAt: cmd.startsAt,
                durationMinutes: cmd.durationMinutes,
                linkedEntityKind: cmd.linkedEntityKind,
                linkedEntityId: cmd.linkedEntityId,
                scheduledByUserId: cmd.scheduledByUserId,
                scheduledAt: new Date(),
            } as InstanceType<
                typeof TelehealthMeetingScheduledEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    changeTelehealthMeetingStatus(
        state: TelehealthMeetingState,
        cmd: ChangeTelehealthMeetingStatusCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Meeting does not exist');
        if (state.status === cmd.status) return;
        ctx!.emit(
            TelehealthMeetingStatusChangedEvent,
            {
                meetingId: state.meetingId,
                tenantId: state.tenantId,
                status: cmd.status,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
            } as InstanceType<
                typeof TelehealthMeetingStatusChangedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
};
