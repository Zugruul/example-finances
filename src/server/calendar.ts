'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import type {
    CalendarConnectionStreamInstance,
    CalendarProvider,
} from '@/domains/calendar';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext, effectiveAttributedId } from '@/lib/actor-context';
import { getCalendarAdapter } from '@/lib/calendar-providers';

async function requireSession() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');
    return session;
}

function connectionStream(
    userId: string,
    provider: string,
    accountId: string,
): CalendarConnectionStreamInstance {
    return `user-${userId}-calendar-${provider}-${accountId}` as CalendarConnectionStreamInstance;
}

/**
 * "Connect" action — placeholder for the real OAuth flow. The
 * provider adapter is currently a stub; this action persists a
 * manually-entered token blob so the storage layer can be
 * exercised end-to-end. Real OAuth lands per provider via a
 * `/api/calendar/<provider>/callback` route + redirect chain.
 */
export const connectCalendarAction = withActorContext(
    async (formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);

        const provider = String(formData.get('provider') ?? '') as CalendarProvider;
        const adapter = getCalendarAdapter(provider);
        if (!adapter) throw new Error(`Unknown provider "${provider}".`);

        const accountEmail = String(
            formData.get('accountEmail') ?? '',
        ).trim();
        if (!accountEmail) throw new Error('Account email is required.');
        const accessToken = String(
            formData.get('accessToken') ?? '',
        ).trim();
        if (!accessToken)
            throw new Error(
                'Access token is required. (Real OAuth flow is per-provider follow-up; paste an existing token for now.)',
            );
        const refreshToken =
            String(formData.get('refreshToken') ?? '').trim() || undefined;
        const displayLabel =
            String(formData.get('displayLabel') ?? '').trim() ||
            accountEmail;

        const connectionId = uuidv7() as SorcUUID;
        const stream = connectionStream(
            String(actorId),
            provider,
            String(connectionId),
        );
        await aggregates.calendarConnection.execute(
            'connectCalendar',
            {
                connectionId,
                userId: actorId,
                provider,
                accountEmail,
                accessToken,
                refreshToken,
                displayLabel,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/settings/calendars');
        redirect(
            withToast(
                '/settings/calendars',
                'success',
                `Connected ${provider}`,
            ),
        );
    },
);

export const disconnectCalendarAction = withActorContext(
    async (connectionId: string) => {
        const session = await requireSession();
        const actorId = effectiveAttributedId(session);

        const doc = await readModels.calendarConnections.findOne({
            connectionId: connectionId as SorcUUID,
        });
        if (!doc) throw new Error('Connection not found.');
        if (String(doc.userId) !== String(actorId)) {
            throw new Error('Forbidden — not your connection.');
        }

        const stream = connectionStream(
            String(doc.userId),
            doc.provider,
            String(doc.connectionId),
        );
        await aggregates.calendarConnection.execute(
            'disconnectCalendar',
            {
                reason: 'user',
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath('/settings/calendars');
        redirect(
            withToast(
                '/settings/calendars',
                'success',
                'Calendar disconnected',
            ),
        );
    },
);

/**
 * Trigger an on-demand sync. The adapter's `syncIncremental` is
 * called and the resulting cursor stored as a `CalendarSynced`
 * event. Stub adapters return an empty result; the storage path
 * still exercises end-to-end so the UI can show "last synced N
 * minutes ago".
 */
export const syncCalendarAction = withActorContext(
    async (connectionId: string) => {
        const session = await requireSession();
        const actorId = effectiveAttributedId(session);

        const doc = await readModels.calendarConnections.findOne({
            connectionId: connectionId as SorcUUID,
        });
        if (!doc) throw new Error('Connection not found.');
        if (String(doc.userId) !== String(actorId)) {
            throw new Error('Forbidden — not your connection.');
        }

        const adapter = getCalendarAdapter(doc.provider);
        const result = await adapter.syncIncremental({
            accessToken: doc.accessToken,
            cursor: doc.syncCursor,
        });

        const stream = connectionStream(
            String(doc.userId),
            doc.provider,
            String(doc.connectionId),
        );
        await aggregates.calendarConnection.execute(
            'markCalendarSynced',
            {
                syncCursor: result.nextCursor,
                imported: result.imported.length,
                exported: 0,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath('/settings/calendars');
        redirect(
            withToast(
                '/settings/calendars',
                'success',
                `Synced — ${result.imported.length} imported`,
            ),
        );
    },
);
