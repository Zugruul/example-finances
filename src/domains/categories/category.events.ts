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

export type CategoryStreamInstance = SorcStreamInstance<`category-${string}`>;
export type CategoryStreamPattern = SorcStreamPattern<`category-${string}`>;

export type CategoryType = 'income' | 'expense' | 'transfer';

// ----- payloads -----

@domain('categories')
export class CategoryCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    categoryId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    name!: string;

    @property({ type: 'string', required: true })
    categoryType!: CategoryType;

    @foreign('categories')
    @property({ type: 'uuid' })
    parentId?: SorcUUID;

    @property({ type: 'string' })
    color?: string;

    @property({ type: 'string' })
    icon?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    createdByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('categories')
export class CategoryRenamedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    categoryId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    name!: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    renamedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    renamedAt!: Date;
}

@domain('categories')
export class CategoryReparentedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    categoryId!: SorcUUID;

    @foreign('categories')
    @property({ type: 'uuid' })
    parentId?: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    reparentedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    reparentedAt!: Date;
}

@domain('categories')
export class CategoryColorChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    categoryId!: SorcUUID;

    @property({ type: 'string' })
    color?: string;

    @property({ type: 'string' })
    icon?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('categories')
export class CategoryArchivedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    categoryId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    archivedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    archivedAt!: Date;
}

// ----- events -----

@domain('categories')
export class CategoryCreatedEvent extends SorcBaseEvent {
    readonly name = 'CategoryCreated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: CategoryStreamInstance,
        public payload: CategoryCreatedPayload,
    ) {
        super();
    }
}

@domain('categories')
export class CategoryRenamedEvent extends SorcBaseEvent {
    readonly name = 'CategoryRenamed' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: CategoryStreamInstance,
        public payload: CategoryRenamedPayload,
    ) {
        super();
    }
}

@domain('categories')
export class CategoryReparentedEvent extends SorcBaseEvent {
    readonly name = 'CategoryReparented' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: CategoryStreamInstance,
        public payload: CategoryReparentedPayload,
    ) {
        super();
    }
}

@domain('categories')
export class CategoryColorChangedEvent extends SorcBaseEvent {
    readonly name = 'CategoryColorChanged' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: CategoryStreamInstance,
        public payload: CategoryColorChangedPayload,
    ) {
        super();
    }
}

@domain('categories')
export class CategoryArchivedEvent extends SorcBaseEvent {
    readonly name = 'CategoryArchived' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: CategoryStreamInstance,
        public payload: CategoryArchivedPayload,
    ) {
        super();
    }
}

export const categoryEvents = [
    CategoryCreatedEvent,
    CategoryRenamedEvent,
    CategoryReparentedEvent,
    CategoryColorChangedEvent,
    CategoryArchivedEvent,
] as const;
