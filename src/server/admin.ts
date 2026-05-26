'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import {
    IMPERSONATION_COOKIE,
    encodeImpersonationCookie,
    decodeImpersonationCookie,
} from '@/lib/impersonation';
import type {
    AdminActionsStreamInstance,
    PlatformRoleStreamInstance,
} from '@/domains/admin';
import type { SorcUUID } from '@event-sorcerer/core';

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.isAdmin) {
        throw new Error('Forbidden — admin only.');
    }
    return session;
}

function adminStream(adminId: string): AdminActionsStreamInstance {
    return `admin-actions-${adminId}` as AdminActionsStreamInstance;
}

function platformRoleStream(userId: string): PlatformRoleStreamInstance {
    return `platform-role-${userId}` as PlatformRoleStreamInstance;
}

export async function startImpersonationAction(formData: FormData) {
    const session = await requireAdmin();
    const adminId = session.user!.id as SorcUUID;
    const targetUserId = String(formData.get('targetUserId') ?? '');
    const targetEmail = String(formData.get('targetEmail') ?? '');
    if (!targetUserId || !targetEmail) {
        throw new Error('Target user id and email are required.');
    }

    const stream = adminStream(adminId);
    await aggregates.adminActions.execute(
        'startImpersonation',
        {
            actorAdminId: adminId,
            targetUserId: targetUserId as SorcUUID,
            targetEmail,
            stream,
        } as never,
        { store: 'mongostore' as never, stream },
    );

    const startedAt = new Date().toISOString();
    const cookie = encodeImpersonationCookie({
        actorAdminId: adminId,
        targetUserId,
        targetEmail,
        startedAt,
    });

    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATION_COOKIE, cookie, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
    });

    revalidatePath('/');
    redirect('/dashboard');
}

export async function endImpersonationAction() {
    const session = await requireAdmin();
    const adminId = session.user!.id as SorcUUID;

    const cookieStore = await cookies();
    const existing = decodeImpersonationCookie(
        cookieStore.get(IMPERSONATION_COOKIE)?.value,
    );

    if (existing) {
        const stream = adminStream(adminId);
        await aggregates.adminActions.execute(
            'endImpersonation',
            {
                actorAdminId: adminId,
                targetUserId: existing.targetUserId as SorcUUID,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
    }

    cookieStore.delete(IMPERSONATION_COOKIE);
    revalidatePath('/');
    redirect('/admin');
}

export async function grantAdminAction(formData: FormData) {
    const session = await requireAdmin();
    const adminId = session.user!.id as SorcUUID;
    const targetUserId = String(formData.get('targetUserId') ?? '');
    if (!targetUserId) {
        throw new Error('Target user id is required.');
    }
    const reasonRaw = formData.get('reason');
    const reason =
        typeof reasonRaw === 'string' && reasonRaw.length > 0
            ? reasonRaw
            : undefined;

    const stream = platformRoleStream(targetUserId);
    await aggregates.platformRole.execute(
        'grantAdmin',
        {
            targetUserId: targetUserId as SorcUUID,
            grantedByUserId: adminId,
            reason,
            stream,
        } as never,
        { store: 'mongostore' as never, stream },
    );

    revalidatePath('/admin/users');
}

export async function removeAdminAction(formData: FormData) {
    const session = await requireAdmin();
    const adminId = session.user!.id as SorcUUID;
    const targetUserId = String(formData.get('targetUserId') ?? '');
    if (!targetUserId) {
        throw new Error('Target user id is required.');
    }
    const reasonRaw = formData.get('reason');
    const reason =
        typeof reasonRaw === 'string' && reasonRaw.length > 0
            ? reasonRaw
            : undefined;

    // Anti-self-lockout: if the admin is removing themselves AND they're the
    // only remaining platform admin, refuse. Allows another admin to remove
    // them, and allows them to remove someone else even if multiple admins
    // exist.
    if (targetUserId === adminId) {
        const admins = await readModels.platformRoles.find({ role: 'admin' });
        if (admins.length <= 1) {
            throw new Error('Cannot remove the last platform admin.');
        }
    }

    const stream = platformRoleStream(targetUserId);
    await aggregates.platformRole.execute(
        'removeAdmin',
        {
            targetUserId: targetUserId as SorcUUID,
            removedByUserId: adminId,
            reason,
            stream,
        } as never,
        { store: 'mongostore' as never, stream },
    );

    revalidatePath('/admin/users');
}
