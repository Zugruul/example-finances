/**
 * Money formatting helpers. Amounts are stored as integer minor units
 * (e.g. cents) and formatted via `Intl.NumberFormat` per currency.
 *
 * No FX conversion in MVP — all aggregations group by `currency`.
 */

const minorUnitDigits: Record<string, number> = {
    JPY: 0,
    KRW: 0,
    VND: 0,
    BHD: 3,
    JOD: 3,
    KWD: 3,
    OMR: 3,
    TND: 3,
};

export function getCurrencyMinorUnits(currency: string): number {
    const c = currency.toUpperCase();
    return minorUnitDigits[c] ?? 2;
}

export function minorUnitsToMajor(
    amountMinor: number,
    currency: string,
): number {
    const digits = getCurrencyMinorUnits(currency);
    return amountMinor / 10 ** digits;
}

export function formatMoney(amountMinor: number, currency: string): string {
    const digits = getCurrencyMinorUnits(currency);
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(amountMinor / 10 ** digits);
    } catch {
        // Fallback if `currency` is not an ISO-4217 code Intl recognizes.
        return `${(amountMinor / 10 ** digits).toFixed(digits)} ${currency}`;
    }
}

/**
 * Parse a decimal-string amount into integer minor units. Rejects negative
 * input (sign comes from event type) and anything not matching the
 * `<digits>[.<fraction>]` shape for the currency's minor-unit width.
 */
export function parseAmountToMinor(
    raw: string,
    currency: string,
): number | null {
    const digits = getCurrencyMinorUnits(currency);
    const trimmed = raw.trim();
    const re =
        digits > 0
            ? new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`)
            : /^\d+$/;
    if (!re.test(trimmed)) return null;
    const major = parseFloat(trimmed);
    if (!Number.isFinite(major) || major < 0) return null;
    return Math.round(major * 10 ** digits);
}
