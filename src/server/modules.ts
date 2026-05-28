'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import { withActorContext, effectiveAttributedId } from '@/lib/actor-context';
import { getModule } from '@/modules/registry';
import type {
    TenantModuleStreamInstance,
} from '@/domains/tenant-modules';
import type { SorcUUID } from '@event-sorcerer/core';
import type { MembershipRole } from '@/domains/tenants';
import { withToast } from '@/lib/toast-url';

/**
 * Server actions that wrap the tenant-modules aggregate. Each one
 * requires owner/admin on the tenant (members can use a module but
 * not change install state).
 */

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

function tenantModuleStream(
    tenantId: string,
    moduleId: string,
): TenantModuleStreamInstance {
    return `tenant-${tenantId}-modules-${moduleId}` as TenantModuleStreamInstance;
}

export const installModuleAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const moduleId = String(formData.get('moduleId') ?? '').trim();
        const manifest = getModule(moduleId);
        if (!manifest) throw new Error(`Unknown module "${moduleId}"`);

        const stream = tenantModuleStream(tenantId, moduleId);
        await aggregates.tenantModule.execute(
            'installModule',
            {
                tenantId: tenantId as SorcUUID,
                moduleId,
                version: manifest.version,
                installedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/', 'layout');
        redirect(
            withToast(
                '/modules',
                'success',
                `Installed ${manifest.name}`,
            ),
        );
    },
);

export const enableModuleAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const moduleId = String(formData.get('moduleId') ?? '').trim();
        const stream = tenantModuleStream(tenantId, moduleId);
        await aggregates.tenantModule.execute(
            'enableModule',
            {
                tenantId: tenantId as SorcUUID,
                moduleId,
                changedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/', 'layout');
        redirect(
            withToast(`/modules`, 'success', `Enabled ${moduleId}`),
        );
    },
);

export const disableModuleAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const moduleId = String(formData.get('moduleId') ?? '').trim();
        const stream = tenantModuleStream(tenantId, moduleId);
        await aggregates.tenantModule.execute(
            'disableModule',
            {
                tenantId: tenantId as SorcUUID,
                moduleId,
                changedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/', 'layout');
        redirect(
            withToast(`/modules`, 'success', `Disabled ${moduleId}`),
        );
    },
);

export const uninstallModuleAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const moduleId = String(formData.get('moduleId') ?? '').trim();
        const manifest = getModule(moduleId);
        if (manifest?.uninstallPolicy === 'forbid') {
            throw new Error(
                `${manifest.name} cannot be uninstalled (builtin).`,
            );
        }
        const reasonRaw = formData.get('reason');
        const reason =
            typeof reasonRaw === 'string' && reasonRaw.length > 0
                ? reasonRaw
                : undefined;

        const stream = tenantModuleStream(tenantId, moduleId);
        await aggregates.tenantModule.execute(
            'uninstallModule',
            {
                tenantId: tenantId as SorcUUID,
                moduleId,
                removedByUserId: actorId,
                reason,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/', 'layout');
        redirect(
            withToast(`/modules`, 'success', `Uninstalled ${moduleId}`),
        );
    },
);
