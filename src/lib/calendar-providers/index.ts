import type { CalendarProvider } from '@/domains/calendar';
import { createStubCalendarAdapter } from './stub-adapter';
import type { CalendarProviderAdapter } from './types';

/**
 * Adapter registry. Each provider has one entry; the value is
 * either a real adapter (when shipped) or the stub. The settings
 * UI uses this to know which providers to surface in the "Connect"
 * dropdown.
 *
 * To add a real provider:
 *   1. Implement `CalendarProviderAdapter` in a new file
 *      (e.g. `google.adapter.ts`).
 *   2. Replace the stub registration here.
 *   3. Add the provider's OAuth client-id / secret to env config.
 */
const ADAPTERS: Record<CalendarProvider, CalendarProviderAdapter> = {
    google: createStubCalendarAdapter('google'),
    microsoft: createStubCalendarAdapter('microsoft'),
    icloud: createStubCalendarAdapter('icloud'),
    caldav: createStubCalendarAdapter('caldav'),
    custom: createStubCalendarAdapter('custom'),
};

export function getCalendarAdapter(
    provider: CalendarProvider,
): CalendarProviderAdapter {
    return ADAPTERS[provider];
}

export function listCalendarProviders(): Array<{
    id: CalendarProvider;
    label: string;
    description: string;
}> {
    return [
        {
            id: 'google',
            label: 'Google Calendar',
            description:
                'Gmail-linked accounts. OAuth 2.0 + Google Calendar v3 API.',
        },
        {
            id: 'microsoft',
            label: 'Microsoft / Outlook',
            description:
                'Outlook.com, Microsoft 365, Exchange Online via Graph.',
        },
        {
            id: 'icloud',
            label: 'iCloud',
            description: 'Apple Calendar via CalDAV + app-specific password.',
        },
        {
            id: 'caldav',
            label: 'CalDAV (generic)',
            description:
                'Any CalDAV-compatible server (Fastmail, Nextcloud, etc).',
        },
        {
            id: 'custom',
            label: 'Custom webhook',
            description:
                'Your own endpoint — useful for non-standard providers.',
        },
    ];
}

export type { CalendarProviderAdapter } from './types';
