/**
 * CLI: rewrite legacy string-typed payload uuids to ObjectId.
 *
 * Background: events persisted BEFORE framework `33d04b8` (payload uuid
 * auto-recurse fix) stored `payload.<uuidField>` as plain strings —
 * `userId`, `tenantId`, `accountId`, etc — instead of `ObjectId`. The
 * read path is a passthrough so this was functionally fine, but it
 * blocks indexed lookups on those fields and looks wrong in Compass.
 *
 * Strategy: scan every doc in the `events` collection. For each
 * payload field whose value is a string that looks like a 24-char hex
 * ObjectId, convert it in-place to an ObjectId. Same for elements in
 * payload arrays (e.g. `revertsTransactionIds: string[]`).
 *
 * The 24-hex test is a structural heuristic — any plain string that
 * happens to be 24 hex chars is ambiguous, but in this app's domain
 * none of the legitimate string payloads (description, name, currency,
 * cadence kind, etc) ever match. We log every field we convert so the
 * operator can spot-check.
 *
 * Usage:
 *   pnpm admin:migrate-uuid-strings           # dry-run, no writes
 *   pnpm admin:migrate-uuid-strings --apply   # actually update
 *
 * Idempotent: an already-ObjectId field is left alone. Re-running is
 * safe.
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const DEFAULT_MONGO_URI =
    'mongodb://admin:password@localhost:27020,localhost:27021,localhost:27022/?authSource=admin&replicaSet=rs0';

const HEX_24 = /^[a-f0-9]{24}$/i;

interface MutationStats {
    scanned: number;
    docsTouched: number;
    fieldsConverted: number;
    byField: Map<string, number>;
}

function looksLikeUuidString(v: unknown): v is string {
    return typeof v === 'string' && HEX_24.test(v);
}

/**
 * Walk a payload object and return a new payload where any string that
 * matches `HEX_24` is converted to an `ObjectId`. Arrays of such
 * strings get element-wise conversion. Nested objects recurse.
 * Returns the same reference (no copy) when nothing changed, so the
 * caller can detect a no-op by referential equality.
 */
function convertPayload(
    payload: Record<string, unknown>,
    fieldPath: string,
    stats: MutationStats,
): Record<string, unknown> {
    let mutated = false;
    const out: Record<string, unknown> = { ...payload };
    for (const [k, v] of Object.entries(payload)) {
        const here = fieldPath ? `${fieldPath}.${k}` : k;
        if (looksLikeUuidString(v)) {
            out[k] = new ObjectId(v);
            stats.fieldsConverted++;
            stats.byField.set(here, (stats.byField.get(here) ?? 0) + 1);
            mutated = true;
        } else if (Array.isArray(v)) {
            const newArr = v.map((el) => {
                if (looksLikeUuidString(el)) {
                    stats.fieldsConverted++;
                    stats.byField.set(here, (stats.byField.get(here) ?? 0) + 1);
                    mutated = true;
                    return new ObjectId(el);
                }
                return el;
            });
            out[k] = newArr;
        } else if (v && typeof v === 'object' && !(v instanceof Date)) {
            const next = convertPayload(
                v as Record<string, unknown>,
                here,
                stats,
            );
            if (next !== v) {
                out[k] = next;
                mutated = true;
            }
        }
    }
    return mutated ? out : payload;
}

async function main(): Promise<number> {
    const apply = process.argv.includes('--apply');
    const uri =
        process.env.AUTH_MONGO_URI ??
        process.env.FINANCES_MONGO_URI ??
        DEFAULT_MONGO_URI;
    const dbName = process.env.FINANCES_DB ?? 'finances';

    const client = new MongoClient(uri);
    await client.connect();
    const coll = client.db(dbName).collection<{
        _id: ObjectId;
        payload?: Record<string, unknown>;
    }>('events');

    const stats: MutationStats = {
        scanned: 0,
        docsTouched: 0,
        fieldsConverted: 0,
        byField: new Map(),
    };

    const cursor = coll.find({}, { projection: { payload: 1 } });
    for await (const doc of cursor) {
        stats.scanned++;
        if (!doc.payload || typeof doc.payload !== 'object') continue;
        const before = doc.payload;
        const after = convertPayload(before, '', stats);
        if (after === before) continue;
        stats.docsTouched++;
        if (apply) {
            await coll.updateOne(
                { _id: doc._id },
                { $set: { payload: after } },
            );
        }
    }

    console.log(`${apply ? 'Applied' : 'Dry-run'} migration:`);
    console.log(`  scanned          ${stats.scanned}`);
    console.log(`  docs touched     ${stats.docsTouched}`);
    console.log(`  fields converted ${stats.fieldsConverted}`);
    if (stats.byField.size > 0) {
        console.log('  by field:');
        const entries = [...stats.byField.entries()].sort(
            (a, b) => b[1] - a[1],
        );
        for (const [k, n] of entries) {
            console.log(`    ${k.padEnd(40, ' ')} ${n}`);
        }
    }
    if (!apply && stats.docsTouched > 0) {
        console.log(
            '\nDry-run complete. Re-run with --apply to commit the changes.',
        );
    }

    await client.close();
    return 0;
}

main()
    .then((code) => process.exit(code))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
