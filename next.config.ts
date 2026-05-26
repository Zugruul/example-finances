import type { NextConfig } from 'next';

// CSP nonces are generated per-request in proxy.ts. The headers below are the
// static security headers that apply to every response.
const staticSecurityHeaders = [
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
];

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: '/:path*',
                headers: staticSecurityHeaders,
            },
        ];
    },
};

export default nextConfig;
