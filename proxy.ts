import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// Next.js 16 renames `middleware` to `proxy`. Runs on the Node runtime.
// Two jobs: (1) attach a per-request CSP nonce to every response; (2) gate
// authenticated routes behind a session.

const PROTECTED_PREFIXES = [
    '/dashboard',
    '/tenants',
    '/profile',
    '/admin',
];

const ADMIN_PREFIX = '/admin';

function generateNonce() {
    // 16 random bytes → base64 (24 chars). Edge-safe Web Crypto API.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
}

function buildCsp(nonce: string) {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https://accounts.google.com https://github.com",
        "frame-ancestors 'none'",
        "form-action 'self' https://accounts.google.com https://github.com",
        "base-uri 'self'",
    ].join('; ');
}

function withCspHeaders(response: NextResponse, nonce: string) {
    response.headers.set('x-nonce', nonce);
    response.headers.set('Content-Security-Policy', buildCsp(nonce));
    return response;
}

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const nonce = generateNonce();

    // Forward the nonce as a request header so RSC can read it via headers().
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);

    // /api/metrics has its own bearer-token gate — never bounce it through auth.
    if (pathname.startsWith('/api/metrics')) {
        return withCspHeaders(
            NextResponse.next({ request: { headers: requestHeaders } }),
            nonce,
        );
    }

    const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!needsAuth) {
        return withCspHeaders(
            NextResponse.next({ request: { headers: requestHeaders } }),
            nonce,
        );
    }

    const session = req.auth;
    if (!session?.user) {
        const url = new URL('/auth/signin', req.nextUrl);
        url.searchParams.set('callbackUrl', pathname);
        return withCspHeaders(NextResponse.redirect(url), nonce);
    }

    if (pathname.startsWith(ADMIN_PREFIX) && !session.user.isAdmin) {
        return withCspHeaders(
            new NextResponse('forbidden', { status: 403 }),
            nonce,
        );
    }

    return withCspHeaders(
        NextResponse.next({ request: { headers: requestHeaders } }),
        nonce,
    );
});

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
