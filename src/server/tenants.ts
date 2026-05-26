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

export async function createTenantAction(formData: FormData) {
    const session = await requireSession();
    const userId = session.user!.id as SorcUUID;
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
            createdByUserId: userId,
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
            invitedByUserId: userId,
            stream: mStream,
        } as never,
        { store: 'mongostore' as never, stream: mStream },
    );

    // 3) Accept the invitation immediately.
    await aggregates.membership.execute(
        'acceptInvite',
        {
            userId,
            displayName: session.user!.name ?? session.user!.email ?? 'Owner',
            stream: mStream,
        } as never,
        { store: 'mongostore' as never, stream: mStream },
    );

    revalidatePath('/tenants');
    redirect(
        withToast(
            `/tenants/${tenantId}`,
            'success',
            `Tenant "${displayName}" created`,
        ),
    );
}

export async function renameTenantAction(
    tenantId: string,
    formData: FormData,
) {
    const session = await requireSession();
    const userId = session.user!.id as SorcUUID;
    await requireRole(tenantId, userId, ['owner', 'admin']);

    const displayName = String(formData.get('displayName') ?? '').trim();
    if (!displayName) throw new Error('Display name is required.');

    const tStream = tenantStream(tenantId);
    await aggregates.tenant.execute(
        'renameTenant',
        {
            displayName,
            renamedByUserId: userId,
            stream: tStream,
        } as never,
        { store: 'mongostore' as never, stream: tStream },
    );

    revalidatePath(`/tenants/${tenantId}`);
    redirect(
        withToast(`/tenants/${tenantId}`, 'success', 'Tenant renamed'),
    );
}

export async function inviteMemberAction(
    tenantId: string,
    formData: FormData,
) {
    const session = await requireSession();
    const userId = session.user!.id as SorcUUID;
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
            invitedByUserId: userId,
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
}

export async function changeMemberRoleByFormAction(formData: FormData) {
    const tenantId = String(formData.get('tenantId') ?? '');
    const membershipId = String(formData.get('membershipId') ?? '');
    const role = String(formData.get('role') ?? 'member') as MembershipRole;
    return changeMemberRoleAction(tenantId, membershipId, role);
}

export async function removeMemberByFormAction(formData: FormData) {
    const tenantId = String(formData.get('tenantId') ?? '');
    const membershipId = String(formData.get('membershipId') ?? '');
    return removeMemberAction(tenantId, membershipId);
}

export async function changeMemberRoleAction(
    tenantId: string,
    membershipId: string,
    role: MembershipRole,
) {
    const session = await requireSession();
    const userId = session.user!.id as SorcUUID;
    await requireRole(tenantId, userId, ['owner', 'admin']);

    const mStream = membershipStream(tenantId, membershipId);
    await aggregates.membership.execute(
        'changeRole',
        {
            role,
            changedByUserId: userId,
            stream: mStream,
        } as never,
        { store: 'mongostore' as never, stream: mStream },
    );

    revalidatePath(`/tenants/${tenantId}/members`);
}

export async function removeMemberAction(
    tenantId: string,
    membershipId: string,
) {
    const session = await requireSession();
    const userId = session.user!.id as SorcUUID;
    await requireRole(tenantId, userId, ['owner', 'admin']);

    const mStream = membershipStream(tenantId, membershipId);
    await aggregates.membership.execute(
        'removeMember',
        {
            removedByUserId: userId,
            stream: mStream,
        } as never,
        { store: 'mongostore' as never, stream: mStream },
    );

    revalidatePath(`/tenants/${tenantId}/members`);
}
