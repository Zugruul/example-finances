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
 * Psychologist module — clinical Note entity.
 *
 * Free-text clinical record per client (optionally tied to one
 * PsychologistSession). Every text field on the payload is
 * cryptoshredded — dropping the tenant's per-tenant key renders
 * every persisted note permanently unreadable. Note locking is
 * one-way: once locked the body can't be edited (audit trail of
 * clinical decisions).
 */

export type PsychologistNoteStreamInstance =
    SorcStreamInstance<`psychologist-note-${string}`>;
export type PsychologistNoteStreamPattern =
    SorcStreamPattern<`psychologist-note-${string}`>;

@domain('psychologist')
export class PsychologistNoteCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    noteId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('psychologist')
    @property({ type: 'uuid', required: true })
    clientId!: SorcUUID;

    @foreign('psychologist')
    @property({ type: 'uuid' })
    sessionId?: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    title!: string;

    @property({ type: 'string', required: true, tags: ['pii'] })
    body!: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    authoredByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    authoredAt!: Date;
}

@domain('psychologist')
export class PsychologistNoteUpdatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    noteId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', tags: ['pii'] })
    title?: string;

    @property({ type: 'string', tags: ['pii'] })
    body?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    updatedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('psychologist')
export class PsychologistNoteLockedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    noteId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    lockedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    lockedAt!: Date;
}

@domain('psychologist')
export class PsychologistNoteCreatedEvent extends SorcBaseEvent {
    readonly name = 'PsychologistNoteCreated' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistNoteStreamInstance,
        public payload: PsychologistNoteCreatedPayload,
    ) {
        super();
    }
}

@domain('psychologist')
export class PsychologistNoteUpdatedEvent extends SorcBaseEvent {
    readonly name = 'PsychologistNoteUpdated' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistNoteStreamInstance,
        public payload: PsychologistNoteUpdatedPayload,
    ) {
        super();
    }
}

@domain('psychologist')
export class PsychologistNoteLockedEvent extends SorcBaseEvent {
    readonly name = 'PsychologistNoteLocked' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistNoteStreamInstance,
        public payload: PsychologistNoteLockedPayload,
    ) {
        super();
    }
}

export const psychologistNoteEvents = [
    PsychologistNoteCreatedEvent,
    PsychologistNoteUpdatedEvent,
    PsychologistNoteLockedEvent,
] as const;
