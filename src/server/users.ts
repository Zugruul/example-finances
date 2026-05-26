'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { aggregates } from '@/sorc';
import type { UserStreamInstance } from '@/domains/users';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';

async function requireSession() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');
    return session;
}

function userStream(userId: string): UserStreamInstance {
    return `user-${userId}` as UserStreamInstance;
}

export async function updateProfileAction(formData: FormData) {
    const session = await requireSession();
    const userId = session.user!.id as SorcUUID;

    const firstName =
        String(formData.get('firstName') ?? '').trim() || undefined;
    const lastName =
        String(formData.get('lastName') ?? '').trim() || undefined;
    const phoneNumber =
        String(formData.get('phoneNumber') ?? '').trim() || undefined;
    const address = String(formData.get('address') ?? '').trim() || undefined;

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
    redirect(withToast('/profile', 'success', 'Profile updated'));
}
