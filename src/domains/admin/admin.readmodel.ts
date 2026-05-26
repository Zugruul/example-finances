import type { SorcUUID } from '@event-sorcerer/core';
import {
    type ImpersonationStartedEvent,
    type ImpersonationEndedEvent,
    type AdminActionTakenEvent,
} from './admin.events';

/**
 * `admin-activity` read model — one doc per audit event. Keyed by the
 * event's UUID so every event becomes its own row. Wave-A appropriate;
 * Wave B can collapse to per-admin docs with embedded action arrays if
 * the audit-log page grows beyond a few hundred entries.
 */
export type AdminActivityDoc = {
    eventId: string;
    actorAdminId: SorcUUID;
    kind: 'ImpersonationStarted' | 'ImpersonationEnded' | 'AdminActionTaken';
    targetUserId?: SorcUUID;
    targetEmail?: string;
    action?: string;
    note?: string;
    /** Only set when `kind === 'ImpersonationEnded'`. */
    reason?: 'user' | 'expired';
    occurredAt: Date;
};

export type AdminActivityListenEvents = readonly [
    { readonly name: 'ImpersonationStarted'; readonly version: '*' },
    { readonly name: 'ImpersonationEnded'; readonly version: '*' },
    { readonly name: 'AdminActionTaken'; readonly version: '*' },
];

export const adminActivityListen: AdminActivityListenEvents = [
    { name: 'ImpersonationStarted', version: '*' },
    { name: 'ImpersonationEnded', version: '*' },
    { name: 'AdminActionTaken', version: '*' },
] as const;

type AdminApplyEvent = (
    | InstanceType<typeof ImpersonationStartedEvent>
    | InstanceType<typeof ImpersonationEndedEvent>
    | InstanceType<typeof AdminActionTakenEvent>
) & { uuid?: string; id?: string };

export function adminActivityKey(event: AdminApplyEvent) {
    return {
        eventId: event.uuid ?? event.id ?? `${event.stream}-${event.revision}`,
    };
}

export function adminActivityApply(
    state: AdminActivityDoc | null,
    event: AdminApplyEvent,
): AdminActivityDoc | null {
    if (state) return state; // append-only — never mutate existing rows.

    const eventId =
        event.uuid ?? event.id ?? `${event.stream}-${event.revision}`;

    switch (event.name) {
        case 'ImpersonationStarted':
            return {
                eventId,
                actorAdminId: event.payload.actorAdminId,
                kind: 'ImpersonationStarted',
                targetUserId: event.payload.targetUserId,
                targetEmail: event.payload.targetEmail,
                occurredAt: event.payload.startedAt,
            };
        case 'ImpersonationEnded':
            return {
                eventId,
                actorAdminId: event.payload.actorAdminId,
                kind: 'ImpersonationEnded',
                targetUserId: event.payload.targetUserId,
                // Pre-2026-05-26 events don't carry `reason`; treat
                // absence as `'user'` per the schema invariant.
                reason: event.payload.reason ?? 'user',
                occurredAt: event.payload.endedAt,
            };
        case 'AdminActionTaken':
            return {
                eventId,
                actorAdminId: event.payload.actorAdminId,
                kind: 'AdminActionTaken',
                action: event.payload.action,
                note: event.payload.note,
                occurredAt: event.payload.occurredAt,
            };
        default:
            return state;
    }
}
