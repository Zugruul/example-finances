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
import type { CommunicationChannel } from './integration.events';

/**
 * Communication module — Reminder entity.
 *
 * A scheduled outbound contact piece. Tenant-scoped. Producers
 * link back to their owning entity via `linkedEntityKind +
 * linkedEntityId` (polymorphic) so e.g. the Psychologist module
 * can ask "list all reminders for sessionId X" without this domain
 * needing to know about sessions.
 *
 * `recipientLabel` and `message` are PII-tagged for cryptoshredding.
 */

export type CommunicationReminderStreamInstance =
    SorcStreamInstance<`communication-reminder-${string}`>;
export type CommunicationReminderStreamPattern =
    SorcStreamPattern<`communication-reminder-${string}`>;

export type CommunicationReminderStatus =
    | 'scheduled'
    | 'sent'
    | 'failed'
    | 'cancelled';

@domain('communication')
export class CommunicationReminderScheduledPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    reminderId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'date', required: true })
    sendAt!: Date;

    @property({ type: 'string', required: true })
    channel!: CommunicationChannel;

    @foreign('communication')
    @property({ type: 'uuid' })
    integrationId?: SorcUUID; // optional — late-bound at send time

    @property({ type: 'string', required: true, tags: ['pii'] })
    recipientLabel!: string;

    @property({ type: 'string', required: true, tags: ['pii'] })
    message!: string;

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

@domain('communication')
export class CommunicationReminderSentPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    reminderId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('communication')
    @property({ type: 'uuid', required: true })
    integrationId!: SorcUUID;

    @property({ type: 'string' })
    providerMessageId?: string;

    @property({ type: 'date', required: true })
    sentAt!: Date;
}

@domain('communication')
export class CommunicationReminderFailedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    reminderId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    reason!: string;

    @property({ type: 'date', required: true })
    failedAt!: Date;
}

@domain('communication')
export class CommunicationReminderCancelledPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    reminderId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    cancelledByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    cancelledAt!: Date;

    @property({ type: 'string', tags: ['pii'] })
    reason?: string;
}

@domain('communication')
export class CommunicationReminderScheduledEvent extends SorcBaseEvent {
    readonly name = 'CommunicationReminderScheduled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationReminderStreamInstance,
        public payload: CommunicationReminderScheduledPayload,
    ) {
        super();
    }
}

@domain('communication')
export class CommunicationReminderSentEvent extends SorcBaseEvent {
    readonly name = 'CommunicationReminderSent' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationReminderStreamInstance,
        public payload: CommunicationReminderSentPayload,
    ) {
        super();
    }
}

@domain('communication')
export class CommunicationReminderFailedEvent extends SorcBaseEvent {
    readonly name = 'CommunicationReminderFailed' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationReminderStreamInstance,
        public payload: CommunicationReminderFailedPayload,
    ) {
        super();
    }
}

@domain('communication')
export class CommunicationReminderCancelledEvent extends SorcBaseEvent {
    readonly name = 'CommunicationReminderCancelled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationReminderStreamInstance,
        public payload: CommunicationReminderCancelledPayload,
    ) {
        super();
    }
}

export const communicationReminderEvents = [
    CommunicationReminderScheduledEvent,
    CommunicationReminderSentEvent,
    CommunicationReminderFailedEvent,
    CommunicationReminderCancelledEvent,
] as const;
