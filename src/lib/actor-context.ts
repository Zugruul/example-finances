import { requestContext, type SorcUUID } from '@event-sorcerer/core';
import { auth } from '@/auth';

/**
 * The user-id to stamp into payload `*ByUserId` fields (recordedByUserId,
 * invitedByUserId, archivedByUserId, etc.) on write paths. During
 * impersonation `session.user.id` is the TARGET's id (so role checks
 * resolve as the target would see them), but writes should still credit
 * the REAL ADMIN — they're the one clicking buttons.
 *
 * Pass the result of `await auth()` (or any object shaped like a
 * NextAuth session). Returns the resolved id as a `SorcUUID`.
 */
export function effectiveAttributedId(session: {
    user?: { id?: string; impersonation?: { actorAdminId: string } };
}): SorcUUID {
    const imp = session.user?.impersonation;
    const id = imp?.actorAdminId ?? session.user?.id;
    if (!id) throw new Error('No user id resolvable from session.');
    return id as SorcUUID;
}

/**
 * Resolves the (actor, onBehalfOf) pair for the current Auth.js session.
 *
 * - Normal request (no impersonation): `actor = session.user.id`,
 *   `onBehalfOf = undefined`.
 * - Impersonating: `actor = impersonation.actorAdminId` (the REAL
 *   admin — they're the one mutating the data and the audit log must
 *   credit them, not the target), `onBehalfOf =
 *   impersonation.targetUserId` (the user whose workspace was
 *   modified, recorded for forensics).
 * - Unauthenticated: both undefined — events published in that scope
 *   (e.g. first-sign-in bootstrap) carry no actor metadata.
 *
 * NOTE: the session callback in `auth.ts` swaps `session.user.id` to
 * the target during impersonation so VIEW-side reads scope to the
 * target. WRITE-side attribution lives in the actor envelope and is
 * resolved here from `impersonation.actorAdminId` directly — NOT from
 * `session.user.id`, which is the target's id during impersonation.
 *
 * The TTL sweep in `auth.ts` clears expired impersonation BEFORE
 * surfacing `session.user.impersonation`, so an expired session
 * reaches here with `impersonation` undefined and is treated as a
 * normal request — exactly the security property we want.
 */
async function resolveActorContext(): Promise<{
    actor?: string;
    onBehalfOf?: string;
}> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return {};

    const imp = session.user?.impersonation;
    if (imp) {
        return {
            actor: imp.actorAdminId,
            onBehalfOf: imp.targetUserId,
        };
    }
    return { actor: userId };
}

/**
 * Wraps a server action so that every event published inside it carries
 * `actor` + `onBehalfOf` envelope metadata stamped by the framework's
 * `actorContextPlugin`. Use:
 *
 * ```ts
 * export const renameTenantAction = withActorContext(
 *     async (tenantId: string, formData: FormData) => {
 *         // ... events published here pick up actor/onBehalfOf ...
 *     },
 * );
 * ```
 *
 * The wrapper is a no-op outside a session (e.g. during the Auth.js
 * sign-in bootstrap path where events fire before a session exists) — it
 * still calls `requestContext.run` so nested code sees `{}`, but the
 * plugin's passthrough handles that cleanly.
 */
export function withActorContext<Args extends readonly unknown[], Result>(
    handler: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
    return async (...args: Args) => {
        const ctx = await resolveActorContext();
        return requestContext.run(ctx, () => handler(...args));
    };
}
