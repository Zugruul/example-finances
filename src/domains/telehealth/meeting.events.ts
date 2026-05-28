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
 * telehealth — generic video meeting room. Tenant-scoped, NOT
 * module-scoped: a future consulting / tutoring / corporate-
 * training module can reuse the same meeting concept. Modules link
 * to a meeting via `meetingId` on their own entities.
 *
 * The `joinUrl` + `hostKey` carry session-specific tokens; both
 * are PII-tagged and cryptoshredded so dropping the tenant's key
 * invalidates room access tokens at the disk layer.
 *
 * Provider-agnostic: the `provider` field records which adapter
 * created the room (jitsi, daily, twilio-rooms, custom-webrtc).
 * Tomorrow's adapter additions don't require a schema change.
 */

export type TelehealthMeetingStreamInstance =
    SorcStreamInstance<`telehealth-meeting-${string}`>;
export type TelehealthMeetingStreamPattern =
    SorcStreamPattern<`telehealth-meeting-${string}`>;

export type TelehealthProvider =
    | 'jitsi'
    | 'daily'
    | 'twilio-rooms'
    | 'custom-webrtc';

export type TelehealthMeetingStatus =
    | 'scheduled'
    | 'in-progress'
    | 'completed'
    | 'cancelled';

@domain('telehealth')
export class TelehealthMeetingScheduledPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    meetingId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    provider!: TelehealthProvider;

    @property({ type: 'string', required: true, tags: ['pii'] })
    joinUrl!: string;

    @property({ type: 'string', tags: ['pii'] })
    hostKey?: string;

    @property({ type: 'date', required: true })
    startsAt!: Date;

    @property({ type: 'number', required: true })
    durationMinutes!: number;

    /** What this meeting belongs to — e.g. 'psychologist-session'. */
    @property({ type: 'string' })
    linkedEntityKind?: string;

    @property({ type: 'uuid' })
    linkedEntityId?: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    scheduledByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    scheduledAt!: Date;
}

@domain('telehealth')
export class TelehealthMeetingStatusChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    meetingId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    status!: TelehealthMeetingStatus;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('telehealth')
export class TelehealthMeetingScheduledEvent extends SorcBaseEvent {
    readonly name = 'TelehealthMeetingScheduled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: TelehealthMeetingStreamInstance,
        public payload: TelehealthMeetingScheduledPayload,
    ) {
        super();
    }
}

@domain('telehealth')
export class TelehealthMeetingStatusChangedEvent extends SorcBaseEvent {
    readonly name = 'TelehealthMeetingStatusChanged' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: TelehealthMeetingStreamInstance,
        public payload: TelehealthMeetingStatusChangedPayload,
    ) {
        super();
    }
}

export const telehealthMeetingEvents = [
    TelehealthMeetingScheduledEvent,
    TelehealthMeetingStatusChangedEvent,
] as const;
