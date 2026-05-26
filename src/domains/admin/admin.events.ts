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

export type AdminActionsStreamInstance =
    SorcStreamInstance<`admin-actions-${string}`>;
export type AdminActionsStreamPattern =
    SorcStreamPattern<`admin-actions-${string}`>;

export type PlatformRoleStreamInstance =
    SorcStreamInstance<`platform-role-${string}`>;
export type PlatformRoleStreamPattern =
    SorcStreamPattern<`platform-role-${string}`>;

// ----- payloads -----

@domain('admin')
export class ImpersonationStartedPayload extends SorcPayload {
    @foreign('users')
    @property({ type: 'uuid', required: true })
    actorAdminId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true, tags: ['pii'] })
    targetUserId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    targetEmail!: string;

    @property({ type: 'date', required: true })
    startedAt!: Date;
}

@domain('admin')
export class ImpersonationEndedPayload extends SorcPayload {
    @foreign('users')
    @property({ type: 'uuid', required: true })
    actorAdminId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true, tags: ['pii'] })
    targetUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    endedAt!: Date;

    /**
     * Why the impersonation ended. `'user'` for the admin clicking
     * "Return to admin" in the banner, `'expired'` for the TTL sweep in
     * the auth.ts session callback. Older events (pre-2026-05-26) do not
     * carry this field — consumers MUST treat absence as `'user'`.
     */
    @property({ type: 'string' })
    reason?: 'user' | 'expired';
}

@domain('admin')
export class AdminActionTakenPayload extends SorcPayload {
    @foreign('users')
    @property({ type: 'uuid', required: true })
    actorAdminId!: SorcUUID;

    @property({ type: 'string', required: true })
    action!: string;

    /** Free-form metadata. Not tagged for cryptoshredding by default. */
    @property({ type: 'string' })
    note?: string;

    @property({ type: 'date', required: true })
    occurredAt!: Date;
}

// ----- events -----

@domain('admin')
export class ImpersonationStartedEvent extends SorcBaseEvent {
    readonly name = 'ImpersonationStarted' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AdminActionsStreamInstance,
        public payload: ImpersonationStartedPayload,
    ) {
        super();
    }
}

@domain('admin')
export class ImpersonationEndedEvent extends SorcBaseEvent {
    readonly name = 'ImpersonationEnded' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AdminActionsStreamInstance,
        public payload: ImpersonationEndedPayload,
    ) {
        super();
    }
}

@domain('admin')
export class AdminActionTakenEvent extends SorcBaseEvent {
    readonly name = 'AdminActionTaken' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: AdminActionsStreamInstance,
        public payload: AdminActionTakenPayload,
    ) {
        super();
    }
}

// ----- platform-role payloads -----

@domain('admin')
export class AdminGrantedPayload extends SorcPayload {
    @foreign('users')
    @property({ type: 'uuid', required: true, tags: ['pii'] })
    userId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true, tags: ['pii'] })
    grantedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    grantedAt!: Date;

    @property({ type: 'string', tags: ['pii'] })
    reason?: string;
}

@domain('admin')
export class AdminRemovedPayload extends SorcPayload {
    @foreign('users')
    @property({ type: 'uuid', required: true, tags: ['pii'] })
    userId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true, tags: ['pii'] })
    removedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    removedAt!: Date;

    @property({ type: 'string', tags: ['pii'] })
    reason?: string;
}

@domain('admin')
export class AdminGrantedEvent extends SorcBaseEvent {
    readonly name = 'AdminGranted' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: PlatformRoleStreamInstance,
        public payload: AdminGrantedPayload,
    ) {
        super();
    }
}

@domain('admin')
export class AdminRemovedEvent extends SorcBaseEvent {
    readonly name = 'AdminRemoved' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: PlatformRoleStreamInstance,
        public payload: AdminRemovedPayload,
    ) {
        super();
    }
}

export const adminEvents = [
    ImpersonationStartedEvent,
    ImpersonationEndedEvent,
    AdminActionTakenEvent,
    AdminGrantedEvent,
    AdminRemovedEvent,
] as const;
