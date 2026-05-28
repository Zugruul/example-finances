'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { aggregates } from '@/sorc';
import type { UserStreamInstance } from '@/domains/users';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext } from '@/lib/actor-context';

async function requireSession() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');
    return session;
}

function userStream(userId: string): UserStreamInstance {
    return `user-${userId}` as UserStreamInstance;
}

export const updateProfileAction = withActorContext(
    async (formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;

        const firstName =
            String(formData.get('firstName') ?? '').trim() || undefined;
        const lastName =
            String(formData.get('lastName') ?? '').trim() || undefined;
        const phoneNumber =
            String(formData.get('phoneNumber') ?? '').trim() || undefined;
        const address =
            String(formData.get('address') ?? '').trim() || undefined;

        const stream = userStream(userId);
        await aggregates.users.execute(
            'updateProfile',
            {
                firstName,
                lastName,
                phoneNumber,
                address,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/profile');
        // Sidebar email / name lives in the root layout.
        revalidatePath('/', 'layout');
        redirect(withToast('/profile', 'success', 'Profile updated'));
    },
);

export const updateDefaultCurrencyAction = withActorContext(
    async (formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const currency = String(formData.get('currency') ?? '')
            .trim()
            .toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
            throw new Error(
                'Currency must be a 3-letter ISO-4217 code (e.g. USD).',
            );
        }

        const stream = userStream(userId);
        await aggregates.users.execute(
            'setDefaultCurrency',
            { currency, stream } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/settings');
        redirect(
            withToast('/settings', 'success', `Default currency set to ${currency}`),
        );
    },
);

export const updateTenantSelectorPrefAction = withActorContext(
    async (formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const rawMode = String(formData.get('mode') ?? '').trim();
        if (
            rawMode !== 'list' &&
            rawMode !== 'dropdown' &&
            rawMode !== 'threshold'
        ) {
            throw new Error(
                'Tenant selector mode must be list, dropdown, or threshold.',
            );
        }
        let threshold: number | undefined;
        if (rawMode === 'threshold') {
            const raw = String(formData.get('threshold') ?? '').trim();
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
                throw new Error('Threshold must be an integer between 1 and 5.');
            }
            threshold = parsed;
        }

        const stream = userStream(userId);
        await aggregates.users.execute(
            'setTenantSelectorPref',
            { mode: rawMode, threshold, stream } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath('/settings');
        revalidatePath('/dashboard');
        redirect(withToast('/settings', 'success', 'Tenant selector updated'));
    },
);
