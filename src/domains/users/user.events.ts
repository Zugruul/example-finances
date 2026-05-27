import {
    SorcBaseEvent,
    SorcStreamInstance,
    SorcStreamPattern,
    SorcPayload,
    SorcUUID,
    domain,
    property,
} from '@event-sorcerer/core';

export type UserStreamInstance = SorcStreamInstance<`user-${string}`>;
export type UserStreamPattern = SorcStreamPattern<`user-${string}`>;

// ----- payloads -----

@domain('users')
export class UserCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    email!: string;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('users')
export class UserProfileUpdatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', tags: ['pii'] })
    firstName?: string;

    @property({ type: 'string', tags: ['pii'] })
    lastName?: string;

    @property({ type: 'string', tags: ['pii'] })
    phoneNumber?: string;

    @property({ type: 'string', tags: ['pii'] })
    address?: string;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('users')
export class UserDeletedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'date', required: true })
    deletedAt!: Date;
}

@domain('users')
export class UserDefaultCurrencyChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', required: true })
    currency!: string;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('users')
export class UserTenantSelectorPrefChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', required: true })
    mode!: string;

    @property({ type: 'number' })
    threshold?: number;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

// ----- events -----

@domain('users')
export class UserCreatedEvent extends SorcBaseEvent {
    readonly name = 'UserCreated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: UserStreamInstance,
        public payload: UserCreatedPayload,
    ) {
        super();
    }
}

@domain('users')
export class UserProfileUpdatedEvent extends SorcBaseEvent {
    readonly name = 'UserProfileUpdated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: UserStreamInstance,
        public payload: UserProfileUpdatedPayload,
    ) {
        super();
    }
}

@domain('users')
export class UserDeletedEvent extends SorcBaseEvent {
    readonly name = 'UserDeleted' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: UserStreamInstance,
        public payload: UserDeletedPayload,
    ) {
        super();
    }
}

@domain('users')
export class UserDefaultCurrencyChangedEvent extends SorcBaseEvent {
    readonly name = 'UserDefaultCurrencyChanged' as const;
    readonly version = '2026-05-27' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: UserStreamInstance,
        public payload: UserDefaultCurrencyChangedPayload,
    ) {
        super();
    }
}

@domain('users')
export class UserTenantSelectorPrefChangedEvent extends SorcBaseEvent {
    readonly name = 'UserTenantSelectorPrefChanged' as const;
    readonly version = '2026-05-27' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: UserStreamInstance,
        public payload: UserTenantSelectorPrefChangedPayload,
    ) {
        super();
    }
}

export const userEvents = [
    UserCreatedEvent,
    UserProfileUpdatedEvent,
    UserDeletedEvent,
    UserDefaultCurrencyChangedEvent,
    UserTenantSelectorPrefChangedEvent,
] as const;
