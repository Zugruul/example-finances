import type { SorcUUID } from '@event-sorcerer/core';
import {
    type ImpersonationStartedEvent,
    type ImpersonationEndedEvent,
    type AdminActionTakenEvent,
    type AdminGrantedEvent,
    type AdminRemovedEvent,
} from './admin.events';

/**
 * `admin-activity` read model — one doc per audit event. Keyed by the
 * event's UUID so every event becomes its own row.
 */
export type AdminActivityDoc = {
    eventId: string;
    actorAdminId: SorcUUID;
    kind:
        | 'ImpersonationStarted'
        | 'ImpersonationEnded'
        | 'AdminActionTaken'
        | 'AdminGranted'
        | 'AdminRemoved';
    targetUserId?: SorcUUID;
    targetEmail?: string;
    action?: string;
    note?: string;
    /** ImpersonationEnded: 'user' | 'expired'. AdminGranted/AdminRemoved: free-form `reason` string. */
    reason?: string;
    occurredAt: Date;
};

export type AdminActivityListenEvents = readonly [
    { readonly name: 'ImpersonationStarted'; readonly version: '*' },
    { readonly name: 'ImpersonationEnded'; readonly version: '*' },
    { readonly name: 'AdminActionTaken'; readonly version: '*' },
    { readonly name: 'AdminGranted'; readonly version: '*' },
    { readonly name: 'AdminRemoved'; readonly version: '*' },
];

export const adminActivityListen: AdminActivityListenEvents = [
    { name: 'ImpersonationStarted', version: '*' },
    { name: 'ImpersonationEnded', version: '*' },
    { name: 'AdminActionTaken', version: '*' },
    { name: 'AdminGranted', version: '*' },
    { name: 'AdminRemoved', version: '*' },
] as const;

type AdminApplyEvent = (
    | InstanceType<typeof ImpersonationStartedEvent>
    | InstanceType<typeof ImpersonationEndedEvent>
    | InstanceType<typeof AdminActionTakenEvent>
    | InstanceType<typeof AdminGrantedEvent>
    | InstanceType<typeof AdminRemovedEvent>
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
        case 'AdminGranted':
            return {
                eventId,
                actorAdminId: event.payload.grantedByUserId,
                kind: 'AdminGranted',
                targetUserId: event.payload.userId,
                reason: event.payload.reason,
                occurredAt: event.payload.grantedAt,
            };
        case 'AdminRemoved':
            return {
                eventId,
                actorAdminId: event.payload.removedByUserId,
                kind: 'AdminRemoved',
                targetUserId: event.payload.userId,
                reason: event.payload.reason,
                occurredAt: event.payload.removedAt,
            };
        default:
            return state;
    }
}
