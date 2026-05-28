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
 * Base Calendar — account-level (NOT module-scoped, NOT tenant-
 * scoped). Lives on the user so a single person can plug in their
 * iCloud, Gmail, Outlook, etc. and have all of their tenants /
 * modules see the same calendar layer.
 *
 * Streams:
 *   user-<userId>-calendar-<provider>-<accountId>
 *
 * Two-way sync model:
 *   - The framework stores connection metadata + a sync cursor.
 *     Each connection has its own provider-specific cursor format
 *     (e.g. Google's `syncToken`, CalDAV's `ctag`, Microsoft's
 *     `deltaLink`).
 *   - Events imported from the external provider land as
 *     `CalendarEventImported`. Events the user creates locally land
 *     as `CalendarEventCreatedLocal` and the sync worker pushes
 *     them out to every connected calendar that opted in.
 *   - The actual OAuth flow + provider API calls live in adapter
 *     modules (`src/lib/calendar-providers/*`). This domain only
 *     owns the durable state.
 *
 * `accessToken`, `refreshToken`, and `displayLabel` are PII-tagged
 * for cryptoshredding — dropping the user's per-user encryption
 * key invalidates every stored token at the disk layer.
 */

export type CalendarConnectionStreamInstance =
    SorcStreamInstance<`user-${string}-calendar-${string}-${string}`>;
export type CalendarConnectionStreamPattern =
    SorcStreamPattern<`user-${string}-calendar-${string}-${string}`>;

export type CalendarProvider =
    | 'google'
    | 'microsoft'
    | 'icloud'
    | 'caldav'
    | 'custom';

export type CalendarConnectionStatus = 'connected' | 'expired' | 'revoked';

@domain('calendar')
export class CalendarConnectedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    connectionId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', required: true })
    provider!: CalendarProvider;

    @property({ type: 'string', required: true, tags: ['pii'] })
    accountEmail!: string;

    @property({ type: 'string', required: true, tags: ['pii'] })
    accessToken!: string;

    @property({ type: 'string', tags: ['pii'] })
    refreshToken?: string;

    @property({ type: 'date' })
    accessTokenExpiresAt?: Date;

    @property({ type: 'string', required: true, tags: ['pii'] })
    displayLabel!: string;

    @property({ type: 'date', required: true })
    connectedAt!: Date;
}

@domain('calendar')
export class CalendarTokenRefreshedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    connectionId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', required: true, tags: ['pii'] })
    accessToken!: string;

    @property({ type: 'string', tags: ['pii'] })
    refreshToken?: string;

    @property({ type: 'date' })
    accessTokenExpiresAt?: Date;

    @property({ type: 'date', required: true })
    refreshedAt!: Date;
}

@domain('calendar')
export class CalendarSyncedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    connectionId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', required: true })
    syncCursor!: string; // provider-specific cursor (syncToken / deltaLink / ctag)

    @property({ type: 'number', required: true })
    imported!: number;

    @property({ type: 'number', required: true })
    exported!: number;

    @property({ type: 'date', required: true })
    syncedAt!: Date;
}

@domain('calendar')
export class CalendarDisconnectedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    connectionId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    userId!: SorcUUID;

    @property({ type: 'string', required: true })
    reason!: 'user' | 'revoked' | 'token-expired';

    @property({ type: 'date', required: true })
    disconnectedAt!: Date;
}

@domain('calendar')
export class CalendarConnectedEvent extends SorcBaseEvent {
    readonly name = 'CalendarConnected' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CalendarConnectionStreamInstance,
        public payload: CalendarConnectedPayload,
    ) {
        super();
    }
}

@domain('calendar')
export class CalendarTokenRefreshedEvent extends SorcBaseEvent {
    readonly name = 'CalendarTokenRefreshed' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CalendarConnectionStreamInstance,
        public payload: CalendarTokenRefreshedPayload,
    ) {
        super();
    }
}

@domain('calendar')
export class CalendarSyncedEvent extends SorcBaseEvent {
    readonly name = 'CalendarSynced' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CalendarConnectionStreamInstance,
        public payload: CalendarSyncedPayload,
    ) {
        super();
    }
}

@domain('calendar')
export class CalendarDisconnectedEvent extends SorcBaseEvent {
    readonly name = 'CalendarDisconnected' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CalendarConnectionStreamInstance,
        public payload: CalendarDisconnectedPayload,
    ) {
        super();
    }
}

export const calendarConnectionEvents = [
    CalendarConnectedEvent,
    CalendarTokenRefreshedEvent,
    CalendarSyncedEvent,
    CalendarDisconnectedEvent,
] as const;
