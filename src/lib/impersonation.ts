import type { MongoClient } from 'mongodb';

export const FINANCES_AUTH_DB = 'finances_auth';
export const SESSIONS_COLLECTION = 'sessions';

export type ImpersonationState = {
    actorAdminId: string;
    targetUserId: string;
    targetEmail: string;
    startedAt: string; // ISO
};

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
    const existing = await sessions.findOne({ sessionToken });
    const prior = existing?.impersonation ?? null;
    if (prior) {
        await sessions.updateOne(
            { sessionToken },
            { $unset: { impersonation: '' } },
        );
    }
    return prior;
}
