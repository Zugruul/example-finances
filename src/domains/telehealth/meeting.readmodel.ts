import type { SorcUUID } from '@event-sorcerer/core';
import type {
    TelehealthMeetingScheduledEvent,
    TelehealthMeetingStatusChangedEvent,
    TelehealthProvider,
    TelehealthMeetingStatus,
} from './meeting.events';

export type TelehealthMeetingDoc = {
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

export type TelehealthMeetingsListenEvents = readonly [
    { readonly name: 'TelehealthMeetingScheduled'; readonly version: '*' },
    {
        readonly name: 'TelehealthMeetingStatusChanged';
        readonly version: '*';
    },
];

export const telehealthMeetingsListen: TelehealthMeetingsListenEvents = [
    { name: 'TelehealthMeetingScheduled', version: '*' },
    { name: 'TelehealthMeetingStatusChanged', version: '*' },
] as const;

type ApplyEvent =
    | InstanceType<typeof TelehealthMeetingScheduledEvent>
    | InstanceType<typeof TelehealthMeetingStatusChangedEvent>;

export function telehealthMeetingsKey(event: ApplyEvent): {
    meetingId: SorcUUID;
} {
    return { meetingId: event.payload.meetingId };
}

export function telehealthMeetingsApply(
    state: TelehealthMeetingDoc | null,
    event: ApplyEvent,
): TelehealthMeetingDoc | null {
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
