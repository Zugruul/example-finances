'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import type {
    CommunicationIntegrationStreamInstance,
    CommunicationReminderStreamInstance,
    CommunicationProvider,
    CommunicationChannel,
} from '@/domains/communication';
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

function integrationStream(
    id: string,
): CommunicationIntegrationStreamInstance {
    return `communication-integration-${id}` as CommunicationIntegrationStreamInstance;
}

function reminderStream(id: string): CommunicationReminderStreamInstance {
    return `communication-reminder-${id}` as CommunicationReminderStreamInstance;
}

// ---------- integrations ----------

export const connectCommunicationIntegrationAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const provider = String(
            formData.get('provider') ?? '',
        ) as CommunicationProvider;
        const validProviders: CommunicationProvider[] = [
            'twilio',
            'resend',
            'whatsapp-cloud',
            'telegram',
            'wechat',
        ];
        if (!validProviders.includes(provider)) {
            throw new Error('Invalid provider.');
        }
        const label = String(formData.get('label') ?? '').trim();
        if (!label) throw new Error('Label is required.');
        // The provider-specific config blob is collected as JSON in
        // the form's `config` text area for now. Per-provider forms
        // with structured fields can replace this in a follow-up.
        const configRaw = String(formData.get('config') ?? '').trim();
        if (!configRaw) throw new Error('Config (JSON) is required.');
        try {
            JSON.parse(configRaw);
        } catch {
            throw new Error('Config must be valid JSON.');
        }

        const integrationId = uuidv7() as SorcUUID;
        const stream = integrationStream(integrationId);
        await aggregates.communicationIntegration.execute(
            'connectCommunicationIntegration',
            {
                integrationId,
                tenantId: tenantId as SorcUUID,
                provider,
                config: configRaw,
                label,
                connectedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/communication/integrations`);
        redirect(
            withToast(
                `/tenants/${tenantId}/communication/integrations`,
                'success',
                `Connected ${provider}`,
            ),
        );
    },
);

export const disableCommunicationIntegrationAction = withActorContext(
    async (tenantId: string, integrationId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);
        const stream = integrationStream(integrationId);
        await aggregates.communicationIntegration.execute(
            'disableCommunicationIntegration',
            {
                tenantId: tenantId as SorcUUID,
                changedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/communication/integrations`);
        redirect(
            withToast(
                `/tenants/${tenantId}/communication/integrations`,
                'success',
                'Integration disabled',
            ),
        );
    },
);

export const enableCommunicationIntegrationAction = withActorContext(
    async (tenantId: string, integrationId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);
        const stream = integrationStream(integrationId);
        await aggregates.communicationIntegration.execute(
            'enableCommunicationIntegration',
            {
                tenantId: tenantId as SorcUUID,
                changedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/communication/integrations`);
        redirect(
            withToast(
                `/tenants/${tenantId}/communication/integrations`,
                'success',
                'Integration enabled',
            ),
        );
    },
);

export const removeCommunicationIntegrationAction = withActorContext(
    async (tenantId: string, integrationId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);
        const stream = integrationStream(integrationId);
        await aggregates.communicationIntegration.execute(
            'removeCommunicationIntegration',
            {
                tenantId: tenantId as SorcUUID,
                removedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/communication/integrations`);
        redirect(
            withToast(
                `/tenants/${tenantId}/communication/integrations`,
                'success',
                'Integration removed',
            ),
        );
    },
);

// ---------- reminders ----------

export const scheduleCommunicationReminderAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);

        const sendAtRaw = String(formData.get('sendAt') ?? '').trim();
        const sendAt = new Date(sendAtRaw);
        if (!Number.isFinite(sendAt.getTime())) {
            throw new Error('Send-at is invalid.');
        }
        const channel = String(
            formData.get('channel') ?? '',
        ) as CommunicationChannel;
        const recipientLabel = String(
            formData.get('recipientLabel') ?? '',
        ).trim();
        if (!recipientLabel) throw new Error('Recipient is required.');
        const message = String(formData.get('message') ?? '').trim();
        if (!message) throw new Error('Message is required.');
        const linkedEntityKindRaw = String(
            formData.get('linkedEntityKind') ?? '',
        ).trim();
        const linkedEntityKind = linkedEntityKindRaw || undefined;
        const linkedEntityIdRaw = String(
            formData.get('linkedEntityId') ?? '',
        ).trim();
        const linkedEntityId = linkedEntityIdRaw
            ? (linkedEntityIdRaw as SorcUUID)
            : undefined;

        const reminderId = uuidv7() as SorcUUID;
        const stream = reminderStream(reminderId);
        await aggregates.communicationReminder.execute(
            'scheduleCommunicationReminder',
            {
                reminderId,
                tenantId: tenantId as SorcUUID,
                sendAt,
                channel,
                recipientLabel,
                message,
                linkedEntityKind,
                linkedEntityId,
                scheduledByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/communication/reminders`);
        redirect(
            withToast(
                `/tenants/${tenantId}/communication/reminders`,
                'success',
                'Reminder scheduled',
            ),
        );
    },
);

export const cancelCommunicationReminderAction = withActorContext(
    async (tenantId: string, reminderId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin', 'member']);
        const stream = reminderStream(reminderId);
        await aggregates.communicationReminder.execute(
            'cancelCommunicationReminder',
            {
                tenantId: tenantId as SorcUUID,
                cancelledByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
        revalidatePath(`/tenants/${tenantId}/communication/reminders`);
        redirect(
            withToast(
                `/tenants/${tenantId}/communication/reminders`,
                'success',
                'Reminder cancelled',
            ),
        );
    },
);
