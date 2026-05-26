import { metricsRegistry } from '@/sorc';
import { NextResponse } from 'next/server';

// Prom-client metrics need the node runtime (uses perf_hooks etc.).
export const runtime = 'nodejs';
// Always scrape live state — never cache.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const expected = process.env.PROM_METRICS_TOKEN;
    if (!expected) {
        return new NextResponse('not configured', { status: 503 });
    }

    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
        return new NextResponse('forbidden', { status: 403 });
    }

    const body = await metricsRegistry.metrics();
    return new NextResponse(body, {
        status: 200,
        headers: { 'Content-Type': metricsRegistry.contentType },
    });
}
