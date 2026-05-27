import type { Cadence } from './template.events';

/** YYYY-MM-DD string helpers, no Date timezone gymnastics. */

export function parseYmd(ymd: string): {
    year: number;
    month: number;
    day: number;
} {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) throw new Error(`Invalid date string ${ymd}`);
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export function ymdToUtc(ymd: string): Date {
    return new Date(`${ymd}T00:00:00Z`);
}

export function addDays(ymd: string, n: number): string {
    const d = ymdToUtc(ymd);
    d.setUTCDate(d.getUTCDate() + n);
    return formatYmd(d);
}

export function addMonths(ymd: string, n: number): string {
    const { year, month, day } = parseYmd(ymd);
    const idx = (year * 12 + (month - 1) + n);
    const newY = Math.floor(idx / 12);
    const newM = (idx % 12) + 1;
    // Clamp day to the new month's last day.
    const lastDay = new Date(Date.UTC(newY, newM, 0)).getUTCDate();
    const newD = Math.min(day, lastDay);
    return `${String(newY).padStart(4, '0')}-${String(newM).padStart(2, '0')}-${String(newD).padStart(2, '0')}`;
}

export function addYears(ymd: string, n: number): string {
    const { year, month, day } = parseYmd(ymd);
    return addMonths(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, n * 12);
}

/**
 * Given a template's cadence + the last materialized date (or `startsOn`
 * if never materialized), compute the NEXT scheduled materialization date
 * as a YYYY-MM-DD string. Returns null when the template has reached
 * `endsOn` or beyond.
 */
export function nextDueOn(
    cadence: Cadence,
    startsOn: string,
    lastMaterializedOn: string | undefined,
    endsOn: string | undefined,
): string | null {
    const cursor = lastMaterializedOn
        ? advance(cadence, lastMaterializedOn)
        : alignToCadence(cadence, startsOn);
    if (endsOn && cursor > endsOn) return null;
    return cursor;
}

/** Advance one period from `from`. */
function advance(cadence: Cadence, from: string): string {
    switch (cadence.kind) {
        case 'daily':
            return addDays(from, 1);
        case 'weekly':
            return addDays(from, 7);
        case 'monthly':
            return addMonths(from, 1);
        case 'yearly':
            return addYears(from, 1);
    }
}

/**
 * Snap `startsOn` to the next on-cadence date (e.g. a weekly template
 * with `dayOfWeek=1` starting on a Wednesday produces the Monday on or
 * after `startsOn`).
 */
function alignToCadence(cadence: Cadence, startsOn: string): string {
    switch (cadence.kind) {
        case 'daily':
            return startsOn;
        case 'weekly': {
            const d = ymdToUtc(startsOn);
            const dow = d.getUTCDay();
            const delta = (cadence.dayOfWeek - dow + 7) % 7;
            return addDays(startsOn, delta);
        }
        case 'monthly': {
            const { year, month, day } = parseYmd(startsOn);
            if (day === cadence.dayOfMonth) return startsOn;
            if (day < cadence.dayOfMonth) {
                const lastDay = new Date(
                    Date.UTC(year, month, 0),
                ).getUTCDate();
                const newD = Math.min(cadence.dayOfMonth, lastDay);
                return `${year}-${String(month).padStart(2, '0')}-${String(newD).padStart(2, '0')}`;
            }
            return addMonths(
                `${year}-${String(month).padStart(2, '0')}-${String(cadence.dayOfMonth).padStart(2, '0')}`,
                1,
            );
        }
        case 'yearly': {
            const { year, month, day } = parseYmd(startsOn);
            const target = `${year}-${String(cadence.month).padStart(2, '0')}-${String(cadence.dayOfMonth).padStart(2, '0')}`;
            if (
                month < cadence.month ||
                (month === cadence.month && day <= cadence.dayOfMonth)
            ) {
                return target;
            }
            return addYears(target, 1);
        }
    }
}

/**
 * All on-cadence due dates between `from` (inclusive) and `to` (inclusive),
 * starting from the snapped-startsOn or the day after lastMaterializedOn.
 */
export function dueDatesUpTo(
    cadence: Cadence,
    startsOn: string,
    lastMaterializedOn: string | undefined,
    endsOn: string | undefined,
    today: string,
): string[] {
    const due: string[] = [];
    let cursor = lastMaterializedOn
        ? advance(cadence, lastMaterializedOn)
        : alignToCadence(cadence, startsOn);
    const limit = endsOn && endsOn < today ? endsOn : today;
    let guard = 0;
    while (cursor <= limit && guard < 10_000) {
        due.push(cursor);
        cursor = advance(cadence, cursor);
        guard++;
    }
    return due;
}
