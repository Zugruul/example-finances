/**
 * GET /api/tenants/[id]/audit/page?olderPa=<iso>&olderUuid=<uuid>&limit=50
 *
 * Returns one newest-first page of tenant-scoped events. Used by the
 * audit page for initial load + infinite-scroll backfill.
 *
 * Auth: requires an active session + a non-removed membership on the
 * tenant (any role). 403 otherwise. 401 if no session at all.
 *
 * Response shape:
 *   { events: RawEvent[], nextOlder: PagedCursor | null,
 *     newest: PagedCursor | null }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    fetchAuditPage,
    type PagedCursor,
} from '@/lib/audit-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertMember(
    tenantId: string,
    userId: string,
): Promise<boolean> {
    const memberships = await readModels.memberships.find({
        tenantId,
        userId,
    });
    return memberships.some((m) => !m.removedAt);
}

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ tenantId: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const { tenantId } = await ctx.params;
    if (!(await assertMember(tenantId, session.user.id))) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const olderPa = url.searchParams.get('olderPa');
    const olderUuid = url.searchParams.get('olderUuid');
    const limit = Number(url.searchParams.get('limit') ?? '50');

    let olderThan: PagedCursor | undefined;
    if (olderPa && olderUuid) {
        olderThan = { publishedAt: olderPa, uuid: olderUuid };
    }

    const page = await fetchAuditPage({ tenantId, olderThan, limit });
    return NextResponse.json(page);
}
