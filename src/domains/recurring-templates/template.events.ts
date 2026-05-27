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

export type TemplateStreamInstance =
    SorcStreamInstance<`template-${string}`>;
export type TemplateStreamPattern =
    SorcStreamPattern<`template-${string}`>;

export type TemplateType = 'income' | 'expense';

export type Cadence =
    | { kind: 'daily' }
    | { kind: 'weekly'; dayOfWeek: number }
    | { kind: 'monthly'; dayOfMonth: number }
    | { kind: 'yearly'; month: number; dayOfMonth: number };

@domain('recurring-templates')
export class TemplateCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    templateId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('accounts')
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    @foreign('categories')
    @property({ type: 'uuid' })
    categoryId?: SorcUUID;

    @property({ type: 'number', required: true })
    amount!: number;

    @property({ type: 'string', tags: ['pii'] })
    description?: string;

    @property({ type: 'string', required: true })
    transactionType!: TemplateType;

    /**
     * Discriminated-union cadence as a structured object. Uses
     * `type: 'object'` (Wave-F framework addition) — the decorator
     * preserves the value as-is on the wire; no JSON-string trampoline.
     */
    @property({ type: 'object', required: true })
    cadence!: Cadence;

    @property({ type: 'string', required: true })
    startsOn!: string;

    @property({ type: 'string' })
    endsOn?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    createdByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('recurring-templates')
export class TemplateUpdatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    templateId!: SorcUUID;

    @property({ type: 'number' })
    amount?: number;

    @property({ type: 'string', tags: ['pii'] })
    description?: string;

    @property({ type: 'object' })
    cadence?: Cadence;

    @property({ type: 'string' })
    endsOn?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    updatedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('recurring-templates')
export class TemplateArchivedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    templateId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    archivedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    archivedAt!: Date;
}

@domain('recurring-templates')
export class TemplateMaterializedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    templateId!: SorcUUID;

    @property({ type: 'string', required: true })
    materializedOn!: string;

    @foreign('transactions')
    @property({ type: 'uuid', required: true })
    transactionId!: SorcUUID;

    @property({ type: 'date', required: true })
    materializedAt!: Date;
}

@domain('recurring-templates')
export class TemplateCreatedEvent extends SorcBaseEvent {
    readonly name = 'TemplateCreated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: TemplateStreamInstance,
        public payload: TemplateCreatedPayload,
    ) {
        super();
    }
}

@domain('recurring-templates')
export class TemplateUpdatedEvent extends SorcBaseEvent {
    readonly name = 'TemplateUpdated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: TemplateStreamInstance,
        public payload: TemplateUpdatedPayload,
    ) {
        super();
    }
}

@domain('recurring-templates')
export class TemplateArchivedEvent extends SorcBaseEvent {
    readonly name = 'TemplateArchived' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: TemplateStreamInstance,
        public payload: TemplateArchivedPayload,
    ) {
        super();
    }
}

@domain('recurring-templates')
export class TemplateMaterializedEvent extends SorcBaseEvent {
    readonly name = 'TemplateMaterialized' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: TemplateStreamInstance,
        public payload: TemplateMaterializedPayload,
    ) {
        super();
    }
}

export const templateEvents = [
    TemplateCreatedEvent,
    TemplateUpdatedEvent,
    TemplateArchivedEvent,
    TemplateMaterializedEvent,
] as const;
