/**
 * GET /api/tenants/[id]/audit/stream?sincePa=<iso>&sinceUuid=<uuid>
 *
 * Server-Sent Events tail of tenant-scoped events.
 *
 * Reconnect/backfill contract:
 *   - On connect the server REPLAYS every event strictly newer than the
 *     `(sincePa, sinceUuid)` query params (or, if absent, the standard
 *     SSE `Last-Event-ID` header which we set to `<isoPa>|<uuid>` on
 *     each frame). Replay frames go out before the live tail attaches,
 *     so the client never misses an event across a reconnect.
 *   - After replay, opens a Mongo change-stream tail filtered to this
 *     tenant's events and forwards every insert as an SSE frame.
 *
 * Auth identical to /audit/page.
 *
 * The framing wraps `{event, occurredAt}` JSON. The SSE `id:` is the
 * event uuid (uuidv7 — sortable) so EventSource auto-reconnect's
 * `Last-Event-ID` header lands on a meaningful resume cursor.
 */
import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';
import { auth } from '@/auth';
import { readModels, sorc } from '@/sorc';
import {
    fetchEventsSince,
    type PagedCursor,
    type RawEvent,
} from '@/lib/audit-query';
import { FINANCES_DB, getSharedMongoClient } from '@/lib/mongo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLL = 'events';
const HEARTBEAT_MS = 25_000; // proxies typically idle-close ~30s; ping ahead.

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

function parseSinceFromLastEventId(header: string | null): PagedCursor | null {
    if (!header) return null;
    const sep = header.indexOf('|');
    if (sep < 0) return null;
    const iso = header.slice(0, sep);
    const uuid = header.slice(sep + 1);
    if (!iso || !uuid) return null;
    return { publishedAt: iso, uuid };
}

function frame(ev: RawEvent): Uint8Array {
    // `id:` is the resume cursor; `data:` is JSON-encoded event payload.
    // We compose `<isoPa>|<uuid>` so a single header round-trips both.
    const id = `${ev.publishedAt}|${ev.uuid}`;
    const data = JSON.stringify(ev);
    return new TextEncoder().encode(`id: ${id}\ndata: ${data}\n\n`);
}

function comment(text: string): Uint8Array {
    return new TextEncoder().encode(`: ${text}\n\n`);
}

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ tenantId: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response('unauthorized', { status: 401 });
    }
    const { tenantId } = await ctx.params;
    if (!(await assertMember(tenantId, session.user.id))) {
        return new Response('forbidden', { status: 403 });
    }

    const url = new URL(req.url);
    const qPa = url.searchParams.get('sincePa');
    const qUuid = url.searchParams.get('sinceUuid');
    const queryCursor: PagedCursor | null =
        qPa && qUuid ? { publishedAt: qPa, uuid: qUuid } : null;
    const headerCursor = parseSinceFromLastEventId(
        req.headers.get('last-event-id'),
    );
    const since = queryCursor ?? headerCursor;

    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let changeStream: any = null;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const safeEnqueue = (chunk: Uint8Array) => {
                if (cancelled) return;
                try {
                    controller.enqueue(chunk);
                } catch {
                    // Stream already closed (client disconnected mid-write).
                }
            };

            // Open comment so proxies flush headers immediately.
            safeEnqueue(comment('open'));

            // 1. Backfill — every event strictly newer than `since`, in
            //    chronological order, so the client can prepend each one
            //    individually and dedupe by uuid.
            if (since) {
                try {
                    const replay = await fetchEventsSince({
                        tenantId,
                        since,
                        limit: 1000,
                    });
                    for (const ev of replay) {
                        if (cancelled) return;
                        safeEnqueue(frame(ev));
                    }
                } catch (err) {
                    console.error('[audit-sse] backfill failed', err);
                }
            }

            // 2. Heartbeat — keeps idle proxies / load balancers from
            //    closing the connection.
            heartbeat = setInterval(() => {
                safeEnqueue(comment('keepalive'));
            }, HEARTBEAT_MS);

            // 3. Live tail via change stream filtered to this tenant.
            try {
                const client = getSharedMongoClient();
                const coll = client
                    .db(FINANCES_DB)
                    .collection<RawDoc>(COLL);
                changeStream = coll.watch(
                    [
                        {
                            $match: {
                                operationType: 'insert',
                                $or: [
                                    {
                                        'fullDocument.stream': `tenant-${tenantId}`,
                                    },
                                    {
                                        'fullDocument.payload.tenantId':
                                            tenantId,
                                    },
                                ],
                            },
                        },
                    ],
                    { fullDocument: 'updateLookup' },
                );

                (async () => {
                    try {
                        for await (const change of changeStream) {
                            if (cancelled) return;
                            const doc = (change as any)
                                .fullDocument as RawDoc;
                            if (!doc) continue;
                            const ev = await decryptOne(doc);
                            if (ev) safeEnqueue(frame(ev));
                        }
                    } catch (err: any) {
                        if (!cancelled) {
                            console.error('[audit-sse] tail error', err);
                            safeEnqueue(
                                comment(
                                    `tail-error: ${String(err?.message ?? err)}`,
                                ),
                            );
                        }
                    }
                })();
            } catch (err) {
                console.error('[audit-sse] failed to open change stream', err);
                safeEnqueue(comment('tail-open-failed'));
            }
        },
        async cancel() {
            cancelled = true;
            if (heartbeat) clearInterval(heartbeat);
            heartbeat = null;
            if (changeStream) {
                try {
                    await changeStream.close();
                } catch {
                    /* ignore */
                }
                changeStream = null;
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}

type RawDoc = {
    _id?: ObjectId;
    uuid: string;
    name: string;
    version: string;
    stream: string;
    publishedAt: Date;
    payload: Record<string, any>;
};

async function decryptOne(doc: RawDoc): Promise<RawEvent | null> {
    try {
        const [decrypted] = (await sorc
            .getPluginManager()
            .executeAfterRetrieval([doc as any], sorc as any)) as unknown as RawDoc[];
        if (!decrypted) return null;
        return {
            uuid: decrypted.uuid,
            name: decrypted.name,
            version: decrypted.version,
            stream: decrypted.stream,
            publishedAt:
                decrypted.publishedAt instanceof Date
                    ? decrypted.publishedAt.toISOString()
                    : new Date(decrypted.publishedAt as any).toISOString(),
            payload: decrypted.payload,
        };
    } catch (err) {
        console.warn('[audit-sse] decrypt failed for', doc.uuid, err);
        return null;
    }
}
