import {
    SorcBaseEvent,
    SorcStreamInstance,
    SorcStreamPattern,
    SorcPayload,
    SorcUUID,
    domain,
    property,
} from '@event-sorcerer/core';

export type TenantStreamInstance = SorcStreamInstance<`tenant-${string}`>;
export type TenantStreamPattern = SorcStreamPattern<`tenant-${string}`>;

// ----- payloads -----

@domain('tenants')
export class TenantCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    displayName!: string;

    @property({ type: 'string', tags: ['pii'] })
    description?: string;

    @property({ type: 'uuid', required: true })
    createdByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('tenants')
export class TenantRenamedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    displayName!: string;

    @property({ type: 'uuid', required: true })
    renamedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    renamedAt!: Date;
}

@domain('tenants')
export class TenantDefaultCurrencyChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    defaultCurrency!: string;

    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('tenants')
export class TenantArchivedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'uuid', required: true })
    archivedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    archivedAt!: Date;
}

// ----- events -----

@domain('tenants')
export class TenantCreatedEvent extends SorcBaseEvent {
    readonly name = 'TenantCreated' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantStreamInstance,
        public payload: TenantCreatedPayload,
    ) {
        super();
    }
}

@domain('tenants')
export class TenantRenamedEvent extends SorcBaseEvent {
    readonly name = 'TenantRenamed' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantStreamInstance,
        public payload: TenantRenamedPayload,
    ) {
        super();
    }
}

@domain('tenants')
export class TenantArchivedEvent extends SorcBaseEvent {
    readonly name = 'TenantArchived' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantStreamInstance,
        public payload: TenantArchivedPayload,
    ) {
        super();
    }
}

@domain('tenants')
export class TenantDefaultCurrencyChangedEvent extends SorcBaseEvent {
    readonly name = 'TenantDefaultCurrencyChanged' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: TenantStreamInstance,
        public payload: TenantDefaultCurrencyChangedPayload,
    ) {
        super();
    }
}

export const tenantEvents = [
    TenantCreatedEvent,
    TenantRenamedEvent,
    TenantArchivedEvent,
    TenantDefaultCurrencyChangedEvent,
] as const;
