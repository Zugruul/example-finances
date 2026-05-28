'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import type {
    PsychologistClientStreamInstance,
    PsychologistSessionStreamInstance,
    PsychologistNoteStreamInstance,
    PsychologistSessionModality,
    PsychologistSessionStatus,
} from '@/domains/psychologist';
import type { MembershipRole } from '@/domains/tenants';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext, effectiveAttributedId } from '@/lib/actor-context';

async function requireSession() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');
    return session;
}

async function requireRole(
    tenantId: string,
    userId: string,
    allowed: readonly MembershipRole[],
) {
    const memberships = await readModels.memberships.find({
        tenantId,
        userId,
    });
    const active = memberships.find((m) => !m.removedAt);
    if (!active || !allowed.includes(active.role)) {
        throw new Error('Forbidden — insufficient role for this tenant.');
    }
    return active;
}

function clientStream(id: string): PsychologistClientStreamInstance {
    return `psychologist-client-${id}` as PsychologistClientStreamInstance;
}
function sessionStream(id: string): PsychologistSessionStreamInstance {
    return `psychologist-session-${id}` as PsychologistSessionStreamInstance;
}
function noteStream(id: string): PsychologistNoteStreamInstance {
    return `psychologist-note-${id}` as PsychologistNoteStreamInstance;
}

// ---------- clients ----------

export const createPsychologistClientAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const firstName = String(formData.get('firstName') ?? '').trim();
        const lastName = String(formData.get('lastName') ?? '').trim();
        if (!firstName || !lastName) {
            throw new Error('First and last name are required.');
        }
        const email = String(formData.get('email') ?? '').trim() || undefined;
        const phone = String(formData.get('phone') ?? '').trim() || undefined;
        const address =
            String(formData.get('address') ?? '').trim() || undefined;
        const dateOfBirth =
            String(formData.get('dateOfBirth') ?? '').trim() || undefined;
        if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
            throw new Error('Date of birth must be YYYY-MM-DD.');
        }
        const intakeNotes =
            String(formData.get('intakeNotes') ?? '').trim() || undefined;

        const clientId = uuidv7() as SorcUUID;
        const stream = clientStream(clientId);
        await aggregates.psychologistClient.execute(
            'createPsychologistClient',
            {
                clientId,
                tenantId: tenantId as SorcUUID,
                firstName,
                lastName,
                email,
                phone,
                address,
                dateOfBirth,
                intakeNotes,
                createdByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/psychologist/clients`);
        redirect(
            withToast(
                `/tenants/${tenantId}/psychologist/clients`,
                'success',
                `Client "${firstName} ${lastName}" added`,
            ),
        );
    },
);

export const archivePsychologistClientAction = withActorContext(
    async (tenantId: string, clientId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);
        const stream = clientStream(clientId);
        await aggregates.psychologistClient.execute(
            'archivePsychologistClient',
            {
                tenantId: tenantId as SorcUUID,
                archivedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/psychologist/clients`);
        redirect(
            withToast(
                `/tenants/${tenantId}/psychologist/clients`,
                'success',
                'Client archived',
            ),
        );
    },
);

// ---------- sessions ----------

export const schedulePsychologistSessionAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const clientId = String(formData.get('clientId') ?? '').trim();
        if (!clientId) throw new Error('Client is required.');
        const startsAtRaw = String(formData.get('startsAt') ?? '').trim();
        if (!startsAtRaw) throw new Error('Start time is required.');
        const startsAt = new Date(startsAtRaw);
        if (!Number.isFinite(startsAt.getTime())) {
            throw new Error('Start time is invalid.');
        }
        const durationMinutes = Number(formData.get('durationMinutes') ?? 50);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            throw new Error('Duration must be a positive number.');
        }
        const modality = String(
            formData.get('modality') ?? 'in-person',
        ) as PsychologistSessionModality;
        if (modality !== 'in-person' && modality !== 'telehealth') {
            throw new Error('Invalid modality.');
        }
        const locationLabel =
            String(formData.get('locationLabel') ?? '').trim() || undefined;

        const sessionId = uuidv7() as SorcUUID;
        const stream = sessionStream(sessionId);
        await aggregates.psychologistSession.execute(
            'schedulePsychologistSession',
            {
                sessionId,
                tenantId: tenantId as SorcUUID,
                clientId: clientId as SorcUUID,
                startsAt,
                durationMinutes,
                modality,
                locationLabel,
                scheduledByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        // Cross-module hook: if the Communication module is installed
        // on this tenant AND the user opted in via the form's
        // reminder fields, schedule a CommunicationReminder linked
        // back to the new session.
        const reminderHoursRaw = String(
            formData.get('reminderHoursBefore') ?? '',
        ).trim();
        const reminderChannel = String(
            formData.get('reminderChannel') ?? '',
        ).trim();
        if (reminderHoursRaw && reminderChannel) {
            try {
                const moduleInstall = await readModels.tenantModules.findOne({
                    aggregateKey: `${tenantId}|communication`,
                });
                if (moduleInstall?.status === 'installed') {
                    const [client] =
                        await readModels.psychologistClients.find({
                            clientId: clientId as SorcUUID,
                        });
                    const recipientLabel =
                        reminderChannel === 'email'
                            ? client?.email
                            : client?.phone;
                    const hoursBefore = Number(reminderHoursRaw);
                    if (
                        recipientLabel &&
                        Number.isFinite(hoursBefore) &&
                        hoursBefore > 0
                    ) {
                        const sendAt = new Date(
                            startsAt.getTime() -
                                hoursBefore * 60 * 60 * 1000,
                        );
                        const reminderId = uuidv7() as SorcUUID;
                        const reminderStream =
                            `communication-reminder-${reminderId}` as never;
                        await aggregates.communicationReminder.execute(
                            'scheduleCommunicationReminder',
                            {
                                reminderId,
                                tenantId: tenantId as SorcUUID,
                                sendAt,
                                channel: reminderChannel,
                                recipientLabel,
                                message: `Reminder: your session is at ${startsAt.toLocaleString()}.`,
                                linkedEntityKind: 'psychologist-session',
                                linkedEntityId: sessionId,
                                scheduledByUserId: actorId,
                                stream: reminderStream,
                            } as never,
                            {
                                store: 'mongostore' as never,
                                stream: reminderStream,
                            },
                        );
                    }
                }
            } catch (err) {
                console.warn(
                    '[psychologist] cross-module reminder schedule failed',
                    err,
                );
            }
        }

        revalidatePath(`/tenants/${tenantId}/psychologist/sessions`);
        redirect(
            withToast(
                `/tenants/${tenantId}/psychologist/sessions`,
                'success',
                'Session scheduled',
            ),
        );
    },
);

export const changePsychologistSessionStatusAction = withActorContext(
    async (
        tenantId: string,
        sessionId: string,
        status: PsychologistSessionStatus,
    ) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);
        const stream = sessionStream(sessionId);
        await aggregates.psychologistSession.execute(
            'changePsychologistSessionStatus',
            {
                tenantId: tenantId as SorcUUID,
                status,
                changedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/psychologist/sessions`);
        redirect(
            withToast(
                `/tenants/${tenantId}/psychologist/sessions`,
                'success',
                `Session marked ${status}`,
            ),
        );
    },
);

// ---------- notes ----------

export const createPsychologistNoteAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const clientId = String(formData.get('clientId') ?? '').trim();
        if (!clientId) throw new Error('Client is required.');
        const sessionIdRaw = String(formData.get('sessionId') ?? '').trim();
        const sessionId = sessionIdRaw
            ? (sessionIdRaw as SorcUUID)
            : undefined;
        const title = String(formData.get('title') ?? '').trim();
        const body = String(formData.get('body') ?? '').trim();
        if (!title || !body) {
            throw new Error('Title and body are required.');
        }
        const noteId = uuidv7() as SorcUUID;
        const stream = noteStream(noteId);
        await aggregates.psychologistNote.execute(
            'createPsychologistNote',
            {
                noteId,
                tenantId: tenantId as SorcUUID,
                clientId: clientId as SorcUUID,
                sessionId,
                title,
                body,
                authoredByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/psychologist/notes`);
        redirect(
            withToast(
                `/tenants/${tenantId}/psychologist/notes`,
                'success',
                'Note saved',
            ),
        );
    },
);

export const lockPsychologistNoteAction = withActorContext(
    async (tenantId: string, noteId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);
        const stream = noteStream(noteId);
        await aggregates.psychologistNote.execute(
            'lockPsychologistNote',
            {
                tenantId: tenantId as SorcUUID,
                lockedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/psychologist/notes`);
        redirect(
            withToast(
                `/tenants/${tenantId}/psychologist/notes`,
                'success',
                'Note locked',
            ),
        );
    },
);
