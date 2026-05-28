'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import {
    type AccountStreamInstance,
    type AccountType,
} from '@/domains/accounts';
import type { MembershipRole } from '@/domains/tenants';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext } from '@/lib/actor-context';
import { parseAmountToMinor } from '@/lib/money';
import { revalidateTenantDashboards } from '@/lib/revalidate-dashboards';

const ACCOUNT_TYPES: readonly AccountType[] = [
    'checking',
    'savings',
    'credit',
    'cash',
    'investment',
];

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

function accountStream(accountId: string): AccountStreamInstance {
    return `account-${accountId}` as AccountStreamInstance;
}

function parseAccountType(raw: string): AccountType {
    if (!ACCOUNT_TYPES.includes(raw as AccountType)) {
        throw new Error(`Invalid account type "${raw}"`);
    }
    return raw as AccountType;
}

function parseCurrency(raw: string): string {
    const c = raw.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) {
        throw new Error(`Invalid currency code "${raw}" (expected ISO-4217)`);
    }
    return c;
}

export const createAccountAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const name = String(formData.get('name') ?? '').trim();
        if (!name) throw new Error('Name is required.');
        const accountType = parseAccountType(
            String(formData.get('accountType') ?? ''),
        );
        const currency = parseCurrency(String(formData.get('currency') ?? ''));
        const openingRaw = String(formData.get('openingBalance') ?? '').trim();
        const openingBalance =
            openingRaw === '' ? 0 : parseAmountToMinor(openingRaw, currency);
        if (openingBalance === null) {
            throw new Error('Opening balance must be a non-negative decimal.');
        }

        const accountId = uuidv7() as SorcUUID;
        const stream = accountStream(accountId);

        await aggregates.account.execute(
            'createAccount',
            {
                accountId,
                tenantId: tenantId as SorcUUID,
                name,
                accountType,
                currency,
                openingBalance,
                createdByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/accounts`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/accounts/${accountId}`,
                'success',
                `Account "${name}" created`,
            ),
        );
    },
);

export const renameAccountAction = withActorContext(
    async (tenantId: string, accountId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const name = String(formData.get('name') ?? '').trim();
        if (!name) throw new Error('Name is required.');

        const stream = accountStream(accountId);
        await aggregates.account.execute(
            'renameAccount',
            {
                name,
                renamedByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/accounts/${accountId}`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/accounts/${accountId}`,
                'success',
                'Account renamed',
            ),
        );
    },
);

export const archiveAccountAction = withActorContext(
    async (tenantId: string, accountId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const stream = accountStream(accountId);
        await aggregates.account.execute(
            'archiveAccount',
            {
                archivedByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/accounts`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/accounts`,
                'success',
                'Account archived',
            ),
        );
    },
);

export const closeAccountAction = withActorContext(
    async (tenantId: string, accountId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const stream = accountStream(accountId);
        await aggregates.account.execute(
            'closeAccount',
            {
                closedByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/accounts`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/accounts`,
                'success',
                'Account closed',
            ),
        );
    },
);
