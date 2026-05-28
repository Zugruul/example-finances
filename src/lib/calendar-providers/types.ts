import type { CalendarProvider } from '@/domains/calendar';

/**
 * Provider adapter contract. One implementation per
 * `CalendarProvider` value. The runtime registry in
 * `src/lib/calendar-providers/index.ts` looks up an adapter by
 * provider name and delegates the OAuth handshake + sync calls.
 *
 * EVERY implementation is currently a stub. Real OAuth + REST
 * calls live behind these methods; this codebase ships the contract
 * + storage layer so the rest of the app (Psychologist sessions,
 * Communication reminders that want to surface "next session at
 * 3pm" in the user's connected calendar) can rely on the data
 * model. Each provider's real implementation is per-provider
 * follow-up work.
 */

export interface ExternalCalendarEvent {
    /** Provider-side stable id (e.g. Google Calendar event id). */
    externalId: string;
    title: string;
    description?: string;
    startsAt: Date;
    endsAt: Date;
    /** Anyone the provider exposes as "location" — string blob. */
    location?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
}

export interface CalendarOAuthInitResponse {
    /** URL to redirect the user's browser to for the OAuth grant. */
    authorizationUrl: string;
    /** Opaque state token the framework should round-trip via the
     *  OAuth `state` query string + verify on callback. */
    stateToken: string;
}

export interface CalendarOAuthCallbackResponse {
    accountEmail: string;
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
}

export interface CalendarSyncResult {
    nextCursor: string;
    imported: ExternalCalendarEvent[];
    deletedExternalIds: string[];
}

export interface CalendarProviderAdapter {
    readonly provider: CalendarProvider;
    /** Step 1 of OAuth: produce the URL we redirect the user to. */
    initOAuth(params: {
        userId: string;
        redirectUri: string;
    }): Promise<CalendarOAuthInitResponse>;
    /** Step 2 of OAuth: trade the code returned by the provider for tokens. */
    handleOAuthCallback(params: {
        code: string;
        state: string;
        redirectUri: string;
    }): Promise<CalendarOAuthCallbackResponse>;
    /** Refresh an expired access token using the stored refresh token. */
    refreshAccessToken(params: {
        refreshToken: string;
    }): Promise<CalendarOAuthCallbackResponse>;
    /**
     * Pull every event added/changed/removed since `cursor`. The
     * returned `nextCursor` is provider-specific (Google's
     * `syncToken`, Microsoft's `deltaLink`, CalDAV's `ctag`).
     */
    syncIncremental(params: {
        accessToken: string;
        cursor?: string;
    }): Promise<CalendarSyncResult>;
    /** Push a new event to the provider. Returns the provider-side id. */
    pushEvent(params: {
        accessToken: string;
        event: Omit<ExternalCalendarEvent, 'externalId'>;
    }): Promise<{ externalId: string }>;
    /** Push an update. */
    updateEvent(params: {
        accessToken: string;
        externalId: string;
        event: Omit<ExternalCalendarEvent, 'externalId'>;
    }): Promise<void>;
    /** Push a delete. */
    deleteEvent(params: {
        accessToken: string;
        externalId: string;
    }): Promise<void>;
}
