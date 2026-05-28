import {
    SorcBaseEvent,
    SorcStreamInstance,
    SorcStreamPattern,
    SorcPayload,
    SorcUUID,
    domain,
    foreign,
    property,
} from '@event-sorcerer/core';

/**
 * Psychologist module — Session entity (appointment).
 *
 * A session is one appointment with a client. Modality is either
 * in-person (uses `locationLabel`) or `telehealth` (references a
 * `telehealthMeetingId` in the generic telehealth domain). The
 * telehealth domain is generic so future modules — e.g. a consulting
 * or tutoring module — can reuse the same meeting-room concept.
 *
 * Status transitions: scheduled → completed | cancelled | no-show.
 */

export type PsychologistSessionStreamInstance =
    SorcStreamInstance<`psychologist-session-${string}`>;
export type PsychologistSessionStreamPattern =
    SorcStreamPattern<`psychologist-session-${string}`>;

export type PsychologistSessionModality = 'in-person' | 'telehealth';
export type PsychologistSessionStatus =
    | 'scheduled'
    | 'completed'
    | 'cancelled'
    | 'no-show';

@domain('psychologist')
export class PsychologistSessionScheduledPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    sessionId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('psychologist')
    @property({ type: 'uuid', required: true })
    clientId!: SorcUUID;

    @property({ type: 'date', required: true })
    startsAt!: Date;

    @property({ type: 'number', required: true })
    durationMinutes!: number;

    @property({ type: 'string', required: true })
    modality!: PsychologistSessionModality;

    @foreign('telehealth')
    @property({ type: 'uuid' })
    telehealthMeetingId?: SorcUUID;

    @property({ type: 'string', tags: ['pii'] })
    locationLabel?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    scheduledByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    scheduledAt!: Date;
}

@domain('psychologist')
export class PsychologistSessionRescheduledPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    sessionId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'date', required: true })
    startsAt!: Date;

    @property({ type: 'number', required: true })
    durationMinutes!: number;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    rescheduledByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    rescheduledAt!: Date;

    @property({ type: 'string', tags: ['pii'] })
    reason?: string;
}

@domain('psychologist')
export class PsychologistSessionStatusChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    sessionId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    status!: PsychologistSessionStatus;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;

    @property({ type: 'string', tags: ['pii'] })
    reason?: string;
}

@domain('psychologist')
export class PsychologistSessionScheduledEvent extends SorcBaseEvent {
    readonly name = 'PsychologistSessionScheduled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistSessionStreamInstance,
        public payload: PsychologistSessionScheduledPayload,
    ) {
        super();
    }
}

@domain('psychologist')
export class PsychologistSessionRescheduledEvent extends SorcBaseEvent {
    readonly name = 'PsychologistSessionRescheduled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistSessionStreamInstance,
        public payload: PsychologistSessionRescheduledPayload,
    ) {
        super();
    }
}

@domain('psychologist')
export class PsychologistSessionStatusChangedEvent extends SorcBaseEvent {
    readonly name = 'PsychologistSessionStatusChanged' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistSessionStreamInstance,
        public payload: PsychologistSessionStatusChangedPayload,
    ) {
        super();
    }
}

export const psychologistSessionEvents = [
    PsychologistSessionScheduledEvent,
    PsychologistSessionRescheduledEvent,
    PsychologistSessionStatusChangedEvent,
] as const;
