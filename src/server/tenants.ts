'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import type {
    TenantStreamInstance,
    MembershipStreamInstance,
    MembershipRole,
} from '@/domains/tenants';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext, effectiveAttributedId } from '@/lib/actor-context';
import { revalidateTenantDashboards } from '@/lib/revalidate-dashboards';

// ----- helpers -----

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
    const memberships = await readModels.memberships.find({ tenantId, userId });
    const active = memberships.find((m) => !m.removedAt);
    if (!active || !allowed.includes(active.role)) {
        throw new Error('Forbidden — insufficient role for this tenant.');
    }
    return active;
}

function tenantStream(tenantId: string): TenantStreamInstance {
    return `tenant-${tenantId}` as TenantStreamInstance;
}

function membershipStream(
    tenantId: string,
    membershipId: string,
): MembershipStreamInstance {
    return `tenant-${tenantId}-membership-${membershipId}` as MembershipStreamInstance;
}

// ----- actions -----

export const createTenantAction = withActorContext(
    async (formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        const displayName = String(formData.get('displayName') ?? '').trim();
        const description =
            String(formData.get('description') ?? '').trim() || undefined;

        if (!displayName) throw new Error('Display name is required.');

        const tenantId = uuidv7() as SorcUUID;
        const membershipId = uuidv7() as SorcUUID;

        const tStream = tenantStream(tenantId);
        const mStream = membershipStream(tenantId, membershipId);

        // 1) Create the tenant.
        await aggregates.tenant.execute(
            'createTenant',
            {
                tenantId,
                displayName,
                description,
                createdByUserId: actorId,
                stream: tStream,
            } as never,
            { store: 'mongostore' as never, stream: tStream },
        );

        // 2) Invite the creator with role 'owner' (auto-accept below).
        await aggregates.membership.execute(
            'inviteMember',
            {
                tenantId,
                membershipId,
                invitedEmail: session.user!.email ?? '',
                role: 'owner',
                invitedByUserId: actorId,
                stream: mStream,
            } as never,
            { store: 'mongostore' as never, stream: mStream },
        );

        // 3) Accept the invitation immediately.
        await aggregates.membership.execute(
            'acceptInvite',
            {
                userId,
                displayName:
                    session.user!.name ?? session.user!.email ?? 'Owner',
                stream: mStream,
            } as never,
            { store: 'mongostore' as never, stream: mStream },
        );

        // 4) Seed the tenant's default currency from the user's
        // "Default currency for new tenants" preference. The user-
        // level setting only kicks in here; once the tenant exists
        // it owns its own per-tenant default.
        try {
            const profile = await readModels.usersById.findOne({
                userId: userId as SorcUUID,
            });
            const seed = profile?.defaultCurrency;
            if (seed && /^[A-Z]{3}$/.test(seed) && seed !== 'USD') {
                await aggregates.tenant.execute(
                    'setTenantDefaultCurrency',
                    {
                        defaultCurrency: seed,
                        changedByUserId: actorId,
                        stream: tStream,
                    } as never,
                    {
                        store: 'mongostore' as never,
                        stream: tStream,
                    },
                );
            }
        } catch (err) {
            console.warn(
                '[create-tenant] failed to seed default currency',
                err,
            );
        }

        revalidatePath('/tenants');
        // Sidebar tenants list lives in the root layout — refresh it so
        // the new tenant appears without a manual reload.
        revalidatePath('/', 'layout');
        redirect(
            withToast(
                `/tenants/${tenantId}`,
                'success',
                `Tenant "${displayName}" created`,
            ),
        );
    },
);

export const updateTenantDefaultCurrencyAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const currency = String(formData.get('currency') ?? '')
            .trim()
            .toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
            throw new Error(
                'Currency must be a 3-letter ISO-4217 code (e.g. USD).',
            );
        }

        const tStream = tenantStream(tenantId);
        await aggregates.tenant.execute(
            'setTenantDefaultCurrency',
            {
                defaultCurrency: currency,
                changedByUserId: actorId,
                stream: tStream,
            } as never,
            { store: 'mongostore' as never, stream: tStream },
        );

        revalidatePath(`/tenants/${tenantId}`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}`,
                'success',
                `Default currency set to ${currency}`,
            ),
        );
    },
);

export const renameTenantAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const displayName = String(formData.get('displayName') ?? '').trim();
        if (!displayName) throw new Error('Display name is required.');

        const tStream = tenantStream(tenantId);
        await aggregates.tenant.execute(
            'renameTenant',
            {
                displayName,
                renamedByUserId: actorId,
                stream: tStream,
            } as never,
            { store: 'mongostore' as never, stream: tStream },
        );

        // Layout-level: tenant name shows in sidebar + breadcrumbs + per-
        // tenant dashboard header, all of which live above the route in
        // the layout tree.
        revalidatePath('/', 'layout');
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(`/tenants/${tenantId}`, 'success', 'Tenant renamed'),
        );
    },
);

export const inviteMemberAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const invitedEmail = String(formData.get('email') ?? '')
            .trim()
            .toLowerCase();
        const role = String(formData.get('role') ?? 'member') as MembershipRole;
        if (!invitedEmail) throw new Error('Email is required.');

        const membershipId = uuidv7() as SorcUUID;
        const mStream = membershipStream(tenantId, membershipId);
        await aggregates.membership.execute(
            'inviteMember',
            {
                tenantId: tenantId as SorcUUID,
                membershipId,
                invitedEmail,
                role,
                invitedByUserId: actorId,
                stream: mStream,
            } as never,
            { store: 'mongostore' as never, stream: mStream },
        );

        revalidatePath(`/tenants/${tenantId}/members`);
        redirect(
            withToast(
                `/tenants/${tenantId}/members`,
                'success',
                `Invited ${invitedEmail}`,
            ),
        );
    },
);

export const changeMemberRoleByFormAction = withActorContext(
    async (formData: FormData) => {
        const tenantId = String(formData.get('tenantId') ?? '');
        const membershipId = String(formData.get('membershipId') ?? '');
        const role = String(formData.get('role') ?? 'member') as MembershipRole;
        return changeMemberRoleAction(tenantId, membershipId, role);
    },
);

export const removeMemberByFormAction = withActorContext(
    async (formData: FormData) => {
        const tenantId = String(formData.get('tenantId') ?? '');
        const membershipId = String(formData.get('membershipId') ?? '');
        return removeMemberAction(tenantId, membershipId);
    },
);

export const changeMemberRoleAction = withActorContext(
    async (tenantId: string, membershipId: string, role: MembershipRole) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const mStream = membershipStream(tenantId, membershipId);
        await aggregates.membership.execute(
            'changeRole',
            {
                role,
                changedByUserId: actorId,
                stream: mStream,
            } as never,
            { store: 'mongostore' as never, stream: mStream },
        );

        revalidatePath(`/tenants/${tenantId}/members`);
        redirect(
            withToast(
                `/tenants/${tenantId}/members`,
                'success',
                `Role updated to ${role}`,
            ),
        );
    },
);

export const removeMemberAction = withActorContext(
    async (tenantId: string, membershipId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const mStream = membershipStream(tenantId, membershipId);
        await aggregates.membership.execute(
            'removeMember',
            {
                removedByUserId: actorId,
                stream: mStream,
            } as never,
            { store: 'mongostore' as never, stream: mStream },
        );

        revalidatePath(`/tenants/${tenantId}/members`);
        redirect(
            withToast(
                `/tenants/${tenantId}/members`,
                'success',
                'Member removed',
            ),
        );
    },
);
