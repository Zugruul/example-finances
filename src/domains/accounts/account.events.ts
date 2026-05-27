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

export type AccountStreamInstance = SorcStreamInstance<`account-${string}`>;
export type AccountStreamPattern = SorcStreamPattern<`account-${string}`>;

export type AccountType =
    | 'checking'
    | 'savings'
    | 'credit'
    | 'cash'
    | 'investment';

// ----- payloads -----

@domain('accounts')
export class AccountCreatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    name!: string;

    @property({ type: 'string', required: true })
    accountType!: AccountType;

    @property({ type: 'string', required: true })
    currency!: string;

    @property({ type: 'number', required: true })
    openingBalance!: number;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    createdByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    createdAt!: Date;
}

@domain('accounts')
export class AccountRenamedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    name!: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    renamedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    renamedAt!: Date;
}

@domain('accounts')
export class AccountTypeChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    @property({ type: 'string', required: true })
    accountType!: AccountType;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('accounts')
export class AccountArchivedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    archivedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    archivedAt!: Date;
}

@domain('accounts')
export class AccountClosedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    accountId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    closedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    closedAt!: Date;
}

// ----- events -----

@domain('accounts')
export class AccountCreatedEvent extends SorcBaseEvent {
    readonly name = 'AccountCreated' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AccountStreamInstance,
        public payload: AccountCreatedPayload,
    ) {
        super();
    }
}

@domain('accounts')
export class AccountRenamedEvent extends SorcBaseEvent {
    readonly name = 'AccountRenamed' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AccountStreamInstance,
        public payload: AccountRenamedPayload,
    ) {
        super();
    }
}

@domain('accounts')
export class AccountTypeChangedEvent extends SorcBaseEvent {
    readonly name = 'AccountTypeChanged' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AccountStreamInstance,
        public payload: AccountTypeChangedPayload,
    ) {
        super();
    }
}

@domain('accounts')
export class AccountArchivedEvent extends SorcBaseEvent {
    readonly name = 'AccountArchived' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AccountStreamInstance,
        public payload: AccountArchivedPayload,
    ) {
        super();
    }
}

@domain('accounts')
export class AccountClosedEvent extends SorcBaseEvent {
    readonly name = 'AccountClosed' as const;
    readonly version = '2026-05-26' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AccountStreamInstance,
        public payload: AccountClosedPayload,
    ) {
        super();
    }
}

export const accountEvents = [
    AccountCreatedEvent,
    AccountRenamedEvent,
    AccountTypeChangedEvent,
    AccountArchivedEvent,
    AccountClosedEvent,
] as const;
