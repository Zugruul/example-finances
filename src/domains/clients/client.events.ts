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
 * clients domain — Psychologist module.
 *
 * Every PII field is tagged `['pii']` so the cryptoshredding plugin
 * encrypts it before persist + decrypts on read. The per-tenant
 * crypto key lives in the `events_crypto_keys` collection;
 * forgetting a tenant means dropping that tenant's key, which
 * renders every PII field on disk permanently unreadable (GDPR
 * "right to be forgotten" with no full-table sweep).
 *
 * Non-PII fields (the audit timestamps, the actor user id, the
 * tenantId itself) are NOT tagged so they remain queryable from
 * the read models.
 */

export type ClientStreamInstance = SorcStreamInstance<`client-${string}`>;
export type ClientStreamPattern = SorcStreamPattern<`client-${string}`>;

@domain('clients')
export class ClientCreatedPayload extends SorcPayload {
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
    dateOfBirth?: string; // YYYY-MM-DD; tagged because exact DOB is PII

    @property({ type: 'string', tags: ['pii'] })
    notes?: string; // free-text intake notes

    @foreign('users')
    @property({ type: 'uuid', required: true })
    createdByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('clients')
export class ClientUpdatedPayload extends SorcPayload {
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
    notes?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    updatedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('clients')
export class ClientArchivedPayload extends SorcPayload {
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

@domain('clients')
export class ClientCreatedEvent extends SorcBaseEvent {
    readonly name = 'ClientCreated' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: ClientStreamInstance,
        public payload: ClientCreatedPayload,
    ) {
        super();
    }
}

@domain('clients')
export class ClientUpdatedEvent extends SorcBaseEvent {
    readonly name = 'ClientUpdated' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: ClientStreamInstance,
        public payload: ClientUpdatedPayload,
    ) {
        super();
    }
}

@domain('clients')
export class ClientArchivedEvent extends SorcBaseEvent {
    readonly name = 'ClientArchived' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: ClientStreamInstance,
        public payload: ClientArchivedPayload,
    ) {
        super();
    }
}

export const clientEvents = [
    ClientCreatedEvent,
    ClientUpdatedEvent,
    ClientArchivedEvent,
] as const;
