import type {
    CalendarOAuthCallbackResponse,
    CalendarOAuthInitResponse,
    CalendarProviderAdapter,
    CalendarSyncResult,
    ExternalCalendarEvent,
} from './types';
import type { CalendarProvider } from '@/domains/calendar';

/**
 * Stub adapter used by every provider until the real OAuth + REST
 * implementation lands. Returns deterministic, clearly-fake values
 * so end-to-end flows can exercise the storage layer + UI without
 * a real provider hookup.
 *
 * Real provider work to slot in here, per file (one per provider):
 *   - google.adapter.ts       → Google Calendar v3 + OAuth 2.0
 *   - microsoft.adapter.ts    → Graph / Outlook + OAuth 2.0
 *   - icloud.adapter.ts       → CalDAV with app-specific password
 *   - caldav.adapter.ts       → generic CalDAV
 *   - custom.adapter.ts       → user-supplied webhook + token
 */
export function createStubCalendarAdapter(
    provider: CalendarProvider,
): CalendarProviderAdapter {
    return {
        provider,
        async initOAuth(): Promise<CalendarOAuthInitResponse> {
            throw new Error(
                `Calendar provider "${provider}" is not yet implemented. The framework's connection storage works; OAuth + sync need a real adapter per provider.`,
            );
        },
        async handleOAuthCallback(): Promise<CalendarOAuthCallbackResponse> {
            throw new Error(
                `Calendar provider "${provider}" OAuth callback not implemented.`,
            );
        },
        async refreshAccessToken(): Promise<CalendarOAuthCallbackResponse> {
            throw new Error(
                `Calendar provider "${provider}" token refresh not implemented.`,
            );
        },
        async syncIncremental(): Promise<CalendarSyncResult> {
            return { nextCursor: '', imported: [], deletedExternalIds: [] };
        },
        async pushEvent(): Promise<{ externalId: string }> {
            throw new Error(
                `Calendar provider "${provider}" pushEvent not implemented.`,
            );
        },
        async updateEvent(): Promise<void> {
            throw new Error(
                `Calendar provider "${provider}" updateEvent not implemented.`,
            );
        },
        async deleteEvent(): Promise<void> {
            throw new Error(
                `Calendar provider "${provider}" deleteEvent not implemented.`,
            );
        },
    };
}
