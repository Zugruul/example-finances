import type { SorcUUID } from '@event-sorcerer/core';
import type {
    PsychologistSessionScheduledEvent,
    PsychologistSessionRescheduledEvent,
    PsychologistSessionStatusChangedEvent,
    PsychologistSessionModality,
    PsychologistSessionStatus,
} from './session.events';

export type PsychologistSessionDoc = {
    sessionId: SorcUUID;
    tenantId: SorcUUID;
    clientId: SorcUUID;
    startsAt: Date;
    durationMinutes: number;
    modality: PsychologistSessionModality;
    telehealthMeetingId?: SorcUUID;
    locationLabel?: string;
    status: PsychologistSessionStatus;
    createdAt: Date;
};

export type PsychologistSessionsListenEvents = readonly [
    { readonly name: 'PsychologistSessionScheduled'; readonly version: '*' },
    { readonly name: 'PsychologistSessionRescheduled'; readonly version: '*' },
    { readonly name: 'PsychologistSessionStatusChanged'; readonly version: '*' },
];

export const psychologistSessionsListen: PsychologistSessionsListenEvents = [
    { name: 'PsychologistSessionScheduled', version: '*' },
    { name: 'PsychologistSessionRescheduled', version: '*' },
    { name: 'PsychologistSessionStatusChanged', version: '*' },
] as const;

type ApplyEvent =
    | InstanceType<typeof PsychologistSessionScheduledEvent>
    | InstanceType<typeof PsychologistSessionRescheduledEvent>
    | InstanceType<typeof PsychologistSessionStatusChangedEvent>;

export function psychologistSessionsKey(event: ApplyEvent): {
    sessionId: SorcUUID;
} {
    return { sessionId: event.payload.sessionId };
}

export function psychologistSessionsApply(
    state: PsychologistSessionDoc | null,
    event: ApplyEvent,
): PsychologistSessionDoc | null {
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
                createdAt: p.scheduledAt,
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
