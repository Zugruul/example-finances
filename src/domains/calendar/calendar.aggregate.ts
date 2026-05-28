import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    CalendarConnectedEvent,
    CalendarTokenRefreshedEvent,
    CalendarSyncedEvent,
    CalendarDisconnectedEvent,
    type CalendarConnectionStreamInstance,
    type CalendarProvider,
    type CalendarConnectionStatus,
} from './calendar.events';

export type CalendarConnectionState = null | {
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

export type CalendarConnectionEvent = InstanceType<
    | typeof CalendarConnectedEvent
    | typeof CalendarTokenRefreshedEvent
    | typeof CalendarSyncedEvent
    | typeof CalendarDisconnectedEvent
>;

export function calendarConnectionReducer(
    state: CalendarConnectionState,
    event: CalendarConnectionEvent,
): CalendarConnectionState {
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

export type ConnectCalendarCmd = {
    connectionId: SorcUUID;
    userId: SorcUUID;
    provider: CalendarProvider;
    accountEmail: string;
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    displayLabel: string;
    stream: CalendarConnectionStreamInstance;
};

export type RefreshCalendarTokenCmd = {
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    stream: CalendarConnectionStreamInstance;
};

export type MarkCalendarSyncedCmd = {
    syncCursor: string;
    imported: number;
    exported: number;
    stream: CalendarConnectionStreamInstance;
};

export type DisconnectCalendarCmd = {
    reason: 'user' | 'revoked' | 'token-expired';
    stream: CalendarConnectionStreamInstance;
};

export const calendarConnectionCommands = {
    connectCalendar(
        state: CalendarConnectionState,
        cmd: ConnectCalendarCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(
                `Calendar connection ${cmd.connectionId} already exists`,
            );
        ctx!.emit(
            CalendarConnectedEvent,
            {
                connectionId: cmd.connectionId,
                userId: cmd.userId,
                provider: cmd.provider,
                accountEmail: cmd.accountEmail,
                accessToken: cmd.accessToken,
                refreshToken: cmd.refreshToken,
                accessTokenExpiresAt: cmd.accessTokenExpiresAt,
                displayLabel: cmd.displayLabel,
                connectedAt: new Date(),
            } as InstanceType<typeof CalendarConnectedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    refreshCalendarToken(
        state: CalendarConnectionState,
        cmd: RefreshCalendarTokenCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Calendar connection does not exist');
        ctx!.emit(
            CalendarTokenRefreshedEvent,
            {
                connectionId: state.connectionId,
                userId: state.userId,
                accessToken: cmd.accessToken,
                refreshToken: cmd.refreshToken,
                accessTokenExpiresAt: cmd.accessTokenExpiresAt,
                refreshedAt: new Date(),
            } as InstanceType<
                typeof CalendarTokenRefreshedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    markCalendarSynced(
        state: CalendarConnectionState,
        cmd: MarkCalendarSyncedCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Calendar connection does not exist');
        ctx!.emit(
            CalendarSyncedEvent,
            {
                connectionId: state.connectionId,
                userId: state.userId,
                syncCursor: cmd.syncCursor,
                imported: cmd.imported,
                exported: cmd.exported,
                syncedAt: new Date(),
            } as InstanceType<typeof CalendarSyncedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    disconnectCalendar(
        state: CalendarConnectionState,
        cmd: DisconnectCalendarCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) return;
        ctx!.emit(
            CalendarDisconnectedEvent,
            {
                connectionId: state.connectionId,
                userId: state.userId,
                reason: cmd.reason,
                disconnectedAt: new Date(),
            } as InstanceType<typeof CalendarDisconnectedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
