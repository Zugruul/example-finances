import type { SorcUUID } from '@event-sorcerer/core';
import type {
    CalendarConnectedEvent,
    CalendarTokenRefreshedEvent,
    CalendarSyncedEvent,
    CalendarDisconnectedEvent,
    CalendarProvider,
    CalendarConnectionStatus,
} from './calendar.events';

export type CalendarConnectionDoc = {
    connectionId: SorcUUID;
    userId: SorcUUID;
    provider: CalendarProvider;
    accountEmail: string;
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    displayLabel: string;
    status: CalendarConnectionStatus;
    syncCursor?: string;
    lastSyncedAt?: Date;
};

export type CalendarConnectionsListenEvents = readonly [
    { readonly name: 'CalendarConnected'; readonly version: '*' },
    { readonly name: 'CalendarTokenRefreshed'; readonly version: '*' },
    { readonly name: 'CalendarSynced'; readonly version: '*' },
    { readonly name: 'CalendarDisconnected'; readonly version: '*' },
];

export const calendarConnectionsListen: CalendarConnectionsListenEvents = [
    { name: 'CalendarConnected', version: '*' },
    { name: 'CalendarTokenRefreshed', version: '*' },
    { name: 'CalendarSynced', version: '*' },
    { name: 'CalendarDisconnected', version: '*' },
] as const;

type ApplyEvent =
    | InstanceType<typeof CalendarConnectedEvent>
    | InstanceType<typeof CalendarTokenRefreshedEvent>
    | InstanceType<typeof CalendarSyncedEvent>
    | InstanceType<typeof CalendarDisconnectedEvent>;

export function calendarConnectionsKey(event: ApplyEvent): {
    connectionId: SorcUUID;
} {
    return { connectionId: event.payload.connectionId };
}

export function calendarConnectionsApply(
    state: CalendarConnectionDoc | null,
    event: ApplyEvent,
): CalendarConnectionDoc | null {
    switch (event.name) {
        case 'CalendarConnected': {
            const p = event.payload;
            return {
                connectionId: p.connectionId,
                userId: p.userId,
                provider: p.provider,
                accountEmail: p.accountEmail,
                accessToken: p.accessToken,
                refreshToken: p.refreshToken,
                accessTokenExpiresAt: p.accessTokenExpiresAt,
                displayLabel: p.displayLabel,
                status: 'connected',
            };
        }
        case 'CalendarTokenRefreshed':
            return state
                ? {
                      ...state,
                      accessToken: event.payload.accessToken,
                      refreshToken:
                          event.payload.refreshToken !== undefined
                              ? event.payload.refreshToken
                              : state.refreshToken,
                      accessTokenExpiresAt:
                          event.payload.accessTokenExpiresAt,
                      status: 'connected',
                  }
                : state;
        case 'CalendarSynced':
            return state
                ? {
                      ...state,
                      syncCursor: event.payload.syncCursor,
                      lastSyncedAt: event.payload.syncedAt,
                  }
                : state;
        case 'CalendarDisconnected':
            return state
                ? {
                      ...state,
                      status:
                          event.payload.reason === 'revoked'
                              ? 'revoked'
                              : 'expired',
                  }
                : state;
        default:
            return state;
    }
}
