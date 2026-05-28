'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import type {
    ClientStreamInstance,
} from '@/domains/clients';
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

function clientStream(clientId: string): ClientStreamInstance {
    return `client-${clientId}` as ClientStreamInstance;
}

export const createClientAction = withActorContext(
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
        const notes = String(formData.get('notes') ?? '').trim() || undefined;

        const clientId = uuidv7() as SorcUUID;
        const stream = clientStream(clientId);
        await aggregates.client.execute(
            'createClient',
            {
                clientId,
                tenantId: tenantId as SorcUUID,
                firstName,
                lastName,
                email,
                phone,
                address,
                dateOfBirth,
                notes,
                createdByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/clients`);
        redirect(
            withToast(
                `/tenants/${tenantId}/clients`,
                'success',
                `Client "${firstName} ${lastName}" added`,
            ),
        );
    },
);

export const archiveClientAction = withActorContext(
    async (tenantId: string, clientId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const stream = clientStream(clientId);
        await aggregates.client.execute(
            'archiveClient',
            {
                tenantId: tenantId as SorcUUID,
                archivedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/clients`);
        redirect(
            withToast(
                `/tenants/${tenantId}/clients`,
                'success',
                'Client archived',
            ),
        );
    },
);
