import { createHmac, timingSafeEqual } from 'crypto';

export const IMPERSONATION_COOKIE = 'finances.impersonate';

export type ImpersonationCookiePayload = {
    actorAdminId: string;
    targetUserId: string;
    targetEmail: string;
    startedAt: string; // ISO
};

function getSecret(): string | null {
    return process.env.AUTH_SECRET ?? null;
}

function sign(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body).digest('base64url');
}

export function encodeImpersonationCookie(
    payload: ImpersonationCookiePayload,
): string {
    const secret = getSecret();
    if (!secret) {
        throw new Error(
            'AUTH_SECRET must be set to sign impersonation cookies',
        );
    }
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${sign(body, secret)}`;
}

export function decodeImpersonationCookie(
    raw: string | undefined,
): ImpersonationCookiePayload | null {
    if (!raw) return null;
    const secret = getSecret();
    if (!secret) return null;
    const dot = raw.lastIndexOf('.');
    if (dot < 1) return null;
    const body = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const expected = sign(body, secret);

    let sigBuf: Buffer;
    let expBuf: Buffer;
    try {
        sigBuf = Buffer.from(sig, 'base64url');
        expBuf = Buffer.from(expected, 'base64url');
    } catch {
        return null;
    }
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    try {
        const json = Buffer.from(body, 'base64url').toString('utf8');
        return JSON.parse(json) as ImpersonationCookiePayload;
    } catch {
        return null;
    }
}
