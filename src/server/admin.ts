'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
    auth,
    authMongoClientPromise,
    SESSION_TOKEN_COOKIE_NAME,
} from '@/auth';
import { aggregates, readModels } from '@/sorc';
import {
    setImpersonationOnSession,
    clearImpersonationFromSession,
} from '@/lib/impersonation';
import type {
    AdminActionsStreamInstance,
    PlatformRoleStreamInstance,
} from '@/domains/admin';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext } from '@/lib/actor-context';

async function requireSessionToken(): Promise<string> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_TOKEN_COOKIE_NAME)?.value;
    if (!token) {
        throw new Error(
            'No Auth.js session cookie present — cannot mutate session impersonation state.',
        );
    }
    return token;
}

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.isAdmin) {
        throw new Error('Forbidden — admin only.');
    }
    return session;
}

/**
 * Resolve the underlying ADMIN user id for the current session. During
 * impersonation the session callback swaps `session.user.id` to the
 * target so all "as a user" reads resolve correctly — but admin actions
 * (start/end impersonation, grant/remove admin, audit attribution)
 * still need the real admin id to credit/blame the right person. This
 * helper returns the admin id from the impersonation envelope when
 * present, otherwise `session.user.id` is the admin id (no swap
 * happened).
 *
 * Caller must have already passed `requireAdmin()`. The returned id is
 * not re-verified to be admin — `requireAdmin()`'s `isAdmin` check
 * (which reads the admin's true role, untouched by impersonation) is
 * the gate.
 */
function resolveAdminId(session: {
    user?: { id?: string; impersonation?: { actorAdminId: string } };
}): SorcUUID {
    const imp = session.user?.impersonation;
    const id = imp?.actorAdminId ?? session.user?.id;
    if (!id) throw new Error('No admin id resolvable from session.');
    return id as SorcUUID;
}

function adminStream(adminId: string): AdminActionsStreamInstance {
    return `admin-actions-${adminId}` as AdminActionsStreamInstance;
}

function platformRoleStream(userId: string): PlatformRoleStreamInstance {
    return `platform-role-${userId}` as PlatformRoleStreamInstance;
}

export const startImpersonationAction = withActorContext(
    async (formData: FormData) => {
        const session = await requireAdmin();
        if (session.user?.impersonation) {
            throw new Error(
                'Already impersonating — end the current session first.',
            );
        }
        const adminId = resolveAdminId(session);
        const targetUserId = String(formData.get('targetUserId') ?? '');
        const targetEmail = String(formData.get('targetEmail') ?? '');
        if (!targetUserId || !targetEmail) {
            throw new Error('Target user id and email are required.');
        }

        const sessionToken = await requireSessionToken();

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

        const client = await authMongoClientPromise;
        await setImpersonationOnSession(client, sessionToken, {
            actorAdminId: adminId,
            targetUserId,
            targetEmail,
            startedAt: new Date().toISOString(),
        });

        revalidatePath('/');
        redirect(
            withToast('/dashboard', 'info', `Impersonating ${targetEmail}`),
        );
    },
);

export const endImpersonationAction = withActorContext(async () => {
    const session = await requireAdmin();
    const adminId = resolveAdminId(session);

    const sessionToken = await requireSessionToken();
    const client = await authMongoClientPromise;
    const prior = await clearImpersonationFromSession(client, sessionToken);

    if (prior) {
        const stream = adminStream(adminId);
        await aggregates.adminActions.execute(
            'endImpersonation',
            {
                actorAdminId: adminId,
                targetUserId: prior.targetUserId as SorcUUID,
                reason: 'user',
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );
    }

    revalidatePath('/');
    redirect(withToast('/admin', 'success', 'Impersonation ended'));
});

export const grantAdminAction = withActorContext(async (formData: FormData) => {
    const session = await requireAdmin();
    const adminId = resolveAdminId(session);
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
    redirect(withToast('/admin/users', 'success', 'Admin granted'));
});

export const removeAdminAction = withActorContext(
    async (formData: FormData) => {
        const session = await requireAdmin();
        const adminId = resolveAdminId(session);
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
            const admins = await readModels.platformRoles.find({
                role: 'admin',
            });
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
        redirect(withToast('/admin/users', 'success', 'Admin removed'));
    },
);
