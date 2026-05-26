import type { MongoClient } from 'mongodb';

export const FINANCES_AUTH_DB = 'finances_auth';
export const SESSIONS_COLLECTION = 'sessions';

/**
 * Hard cap on a single impersonation session. After this many ms since
 * `startedAt`, the session-callback sweep ends it automatically and emits
 * a synthetic `ImpersonationEnded {reason:'expired'}` audit event.
 *
 * 60 minutes is a deliberate trade-off: long enough that an admin
 * investigating a user's issue doesn't get kicked mid-flow, short enough
 * that a forgotten/abandoned impersonation session can't sit indefinitely
 * (the "admin walked away from their laptop" footgun).
 */
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

export type ImpersonationState = {
    actorAdminId: string;
    targetUserId: string;
    targetEmail: string;
    startedAt: string; // ISO
};

export function isImpersonationExpired(
    state: ImpersonationState,
    now: number = Date.now(),
): boolean {
    const startedMs = Date.parse(state.startedAt);
    if (!Number.isFinite(startedMs)) return true; // corrupt → treat as expired
    return now - startedMs >= IMPERSONATION_TTL_MS;
}

/**
 * Remaining milliseconds in the current impersonation session, clamped at
 * zero. Used for the banner's "Nm remaining" label. Returns 0 for a
 * corrupt `startedAt` (banner shows "0m remaining" — the sweep will
 * clear it on the next request).
 */
export function impersonationRemainingMs(
    state: ImpersonationState,
    now: number = Date.now(),
): number {
    const startedMs = Date.parse(state.startedAt);
    if (!Number.isFinite(startedMs)) return 0;
    const remaining = IMPERSONATION_TTL_MS - (now - startedMs);
    return remaining > 0 ? remaining : 0;
}

type SessionDoc = {
    sessionToken: string;
    impersonation?: ImpersonationState;
};

export async function setImpersonationOnSession(
    client: MongoClient,
    sessionToken: string,
    state: ImpersonationState,
): Promise<void> {
    const result = await client
        .db(FINANCES_AUTH_DB)
        .collection<SessionDoc>(SESSIONS_COLLECTION)
        .updateOne({ sessionToken }, { $set: { impersonation: state } });
    if (result.matchedCount === 0) {
        throw new Error(
            'No active session document found for the current session token.',
        );
    }
}

export async function clearImpersonationFromSession(
    client: MongoClient,
    sessionToken: string,
): Promise<ImpersonationState | null> {
    const sessions = client
        .db(FINANCES_AUTH_DB)
        .collection<SessionDoc>(SESSIONS_COLLECTION);
    // CAS-shape: findOneAndUpdate returns the prior document atomically.
    // Concurrent callers can't both observe an `impersonation` field —
    // only one wins the $unset.
    const prior = await sessions.findOneAndUpdate(
        { sessionToken, impersonation: { $exists: true } },
        { $unset: { impersonation: '' } },
        { returnDocument: 'before' },
    );
    return prior?.impersonation ?? null;
}

/**
 * CAS-atomic sweep for the TTL expiry path. Clears `impersonation` only
 * if the field still exists AND its `startedAt` matches the value the
 * caller saw. The match-on-startedAt guard prevents the sweep from
 * clobbering a fresh impersonation that the admin started between the
 * session-callback read and the sweep write (e.g., the admin ended the
 * old session and started a new one in a concurrent tab).
 *
 * Returns the prior state when this caller's `findOneAndUpdate` actually
 * performed the clear — callers MUST emit the synthetic
 * `ImpersonationEnded {reason:'expired'}` audit event only on a
 * non-null return. Concurrent sweeps see null and stay silent.
 */
export async function sweepExpiredImpersonation(
    client: MongoClient,
    sessionToken: string,
    startedAtIso: string,
): Promise<ImpersonationState | null> {
    const sessions = client
        .db(FINANCES_AUTH_DB)
        .collection<SessionDoc>(SESSIONS_COLLECTION);
    const prior = await sessions.findOneAndUpdate(
        {
            sessionToken,
            'impersonation.startedAt': startedAtIso,
        },
        { $unset: { impersonation: '' } },
        { returnDocument: 'before' },
    );
    return prior?.impersonation ?? null;
}
