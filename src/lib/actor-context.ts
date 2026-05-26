import { requestContext } from '@event-sorcerer/core';
import { auth } from '@/auth';

/**
 * Resolves the (actor, onBehalfOf) pair for the current Auth.js session.
 *
 * - Normal request (no impersonation): `actor = session.user.id`,
 *   `onBehalfOf = undefined`.
 * - Impersonating: `actor = session.user.impersonation.targetUserId` (the
 *   user the admin is "being"), `onBehalfOf = session.user.impersonation
 *   .actorAdminId` (the real admin).
 * - Unauthenticated: both undefined — events published in that scope
 *   (e.g. first-sign-in bootstrap) carry no actor metadata. The
 *   `actorContextPlugin` is a passthrough when both fields are undefined.
 *
 * NOTE: the TTL sweep in `auth.ts` clears expired impersonation BEFORE
 * surfacing `session.user.impersonation`, so an expired session reaches
 * here with `impersonation` undefined and is treated as a normal request
 * — exactly the security property we want.
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
            actor: imp.targetUserId,
            onBehalfOf: imp.actorAdminId,
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
