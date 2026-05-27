import 'server-only';
import { cookies } from 'next/headers';

export const LAST_TENANT_COOKIE = 'finances.last-tenant';

const isProd = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
    path: '/',
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: isProd,
    maxAge: 60 * 60 * 24 * 365,
};

export async function readLastTenantCookie(): Promise<string | undefined> {
    const jar = await cookies();
    return jar.get(LAST_TENANT_COOKIE)?.value || undefined;
}

export async function writeLastTenantCookie(tenantId: string): Promise<void> {
    const jar = await cookies();
    jar.set(LAST_TENANT_COOKIE, tenantId, COOKIE_OPTIONS);
}
