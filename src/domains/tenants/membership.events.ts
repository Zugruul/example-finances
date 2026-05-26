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

export type MembershipStreamInstance =
    SorcStreamInstance<`tenant-${string}-membership-${string}`>;
export type MembershipStreamPattern =
    SorcStreamPattern<`tenant-${string}-membership-${string}`>;

export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';

// ----- payloads -----

@domain('tenants')
export class MemberInvitedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'uuid', required: true })
    membershipId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    invitedEmail!: string;

    @property({ type: 'string', required: true })
    role!: MembershipRole;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    invitedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    invitedAt!: Date;
}

@domain('tenants')
export class InvitationAcceptedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'uuid', required: true })
    membershipId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true, tags: ['pii'] })
    userId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    displayName!: string;

    @property({ type: 'date', required: true })
    acceptedAt!: Date;
}

@domain('tenants')
export class MemberRoleChangedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'uuid', required: true })
    membershipId!: SorcUUID;

    @property({ type: 'string', required: true })
    role!: MembershipRole;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('tenants')
export class MemberRemovedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'uuid', required: true })
    membershipId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    removedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    removedAt!: Date;
}

// ----- events -----

@domain('tenants')
export class MemberInvitedEvent extends SorcBaseEvent {
    readonly name = 'MemberInvited' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: MembershipStreamInstance,
        public payload: MemberInvitedPayload,
    ) {
        super();
    }
}

@domain('tenants')
export class InvitationAcceptedEvent extends SorcBaseEvent {
    readonly name = 'InvitationAccepted' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: MembershipStreamInstance,
        public payload: InvitationAcceptedPayload,
    ) {
        super();
    }
}

@domain('tenants')
export class MemberRoleChangedEvent extends SorcBaseEvent {
    readonly name = 'MemberRoleChanged' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: MembershipStreamInstance,
        public payload: MemberRoleChangedPayload,
    ) {
        super();
    }
}

@domain('tenants')
export class MemberRemovedEvent extends SorcBaseEvent {
    readonly name = 'MemberRemoved' as const;
    readonly version = '2026-05-25' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;

    constructor(
        public stream: MembershipStreamInstance,
        public payload: MemberRemovedPayload,
    ) {
        super();
    }
}

export const membershipEvents = [
    MemberInvitedEvent,
    InvitationAcceptedEvent,
    MemberRoleChangedEvent,
    MemberRemovedEvent,
] as const;
