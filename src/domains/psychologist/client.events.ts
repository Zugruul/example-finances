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
 * Psychologist module — Client entity.
 *
 * Every PII field is tagged `['pii']` so the cryptoshredding plugin
 * encrypts it before persist + decrypts on read. The per-tenant
 * crypto key lives in the `events_crypto_keys` collection;
 * forgetting a tenant means dropping that tenant's key, which
 * renders every persisted PII field on disk permanently unreadable.
 *
 * Stream prefix `psychologist-client-` keeps the module's streams
 * easy to identify in `streamPrefixRange` queries / migrations.
 */

export type PsychologistClientStreamInstance =
    SorcStreamInstance<`psychologist-client-${string}`>;
export type PsychologistClientStreamPattern =
    SorcStreamPattern<`psychologist-client-${string}`>;

@domain('psychologist')
export class PsychologistClientCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    clientId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    firstName!: string;

    @property({ type: 'string', required: true, tags: ['pii'] })
    lastName!: string;

    @property({ type: 'string', tags: ['pii'] })
    email?: string;

    @property({ type: 'string', tags: ['pii'] })
    phone?: string;

    @property({ type: 'string', tags: ['pii'] })
    address?: string;

    @property({ type: 'string', tags: ['pii'] })
    dateOfBirth?: string;

    @property({ type: 'string', tags: ['pii'] })
    intakeNotes?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    createdByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('psychologist')
export class PsychologistClientUpdatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    clientId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', tags: ['pii'] })
    firstName?: string;

    @property({ type: 'string', tags: ['pii'] })
    lastName?: string;

    @property({ type: 'string', tags: ['pii'] })
    email?: string;

    @property({ type: 'string', tags: ['pii'] })
    phone?: string;

    @property({ type: 'string', tags: ['pii'] })
    address?: string;

    @property({ type: 'string', tags: ['pii'] })
    dateOfBirth?: string;

    @property({ type: 'string', tags: ['pii'] })
    intakeNotes?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    updatedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('psychologist')
export class PsychologistClientArchivedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    clientId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    archivedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    archivedAt!: Date;
}

@domain('psychologist')
export class PsychologistClientCreatedEvent extends SorcBaseEvent {
    readonly name = 'PsychologistClientCreated' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistClientStreamInstance,
        public payload: PsychologistClientCreatedPayload,
    ) {
        super();
    }
}

@domain('psychologist')
export class PsychologistClientUpdatedEvent extends SorcBaseEvent {
    readonly name = 'PsychologistClientUpdated' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistClientStreamInstance,
        public payload: PsychologistClientUpdatedPayload,
    ) {
        super();
    }
}

@domain('psychologist')
export class PsychologistClientArchivedEvent extends SorcBaseEvent {
    readonly name = 'PsychologistClientArchived' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: PsychologistClientStreamInstance,
        public payload: PsychologistClientArchivedPayload,
    ) {
        super();
    }
}

export const psychologistClientEvents = [
    PsychologistClientCreatedEvent,
    PsychologistClientUpdatedEvent,
    PsychologistClientArchivedEvent,
] as const;
