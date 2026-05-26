import type { SorcUUID } from '@event-sorcerer/core';
import {
    type TenantCreatedEvent,
    type TenantRenamedEvent,
    type TenantArchivedEvent,
    type MemberInvitedEvent,
    type InvitationAcceptedEvent,
    type MemberRoleChangedEvent,
    type MemberRemovedEvent,
} from '@/domains/tenants';
import {
    type ImpersonationStartedEvent,
    type ImpersonationEndedEvent,
    type AdminActionTakenEvent,
    type AdminGrantedEvent,
    type AdminRemovedEvent,
} from '@/domains/admin';

/**
 * Cross-domain activity feed. One doc per published event. Subscribes to
 * every domain's events; the dashboard's "Recent activity" feed reads
 * this read model directly instead of synthesising from per-aggregate
 * timestamps. Append-only.
 *
 * Keyed by `eventId` (the event's uuid, falling back to
 * `${stream}-${revision}` for older events that pre-date the uuid field).
 */
export type ActivityDomain = 'tenants' | 'admin';

export type ActivityKind =
    | 'TenantCreated'
    | 'TenantRenamed'
    | 'TenantArchived'
    | 'MemberInvited'
    | 'InvitationAccepted'
    | 'MemberRoleChanged'
    | 'MemberRemoved'
    | 'ImpersonationStarted'
    | 'ImpersonationEnded'
    | 'AdminActionTaken'
    | 'AdminGranted'
    | 'AdminRemoved';

export type ActivityDoc = {
    eventId: string;
    eventName: ActivityKind;
    domain: ActivityDomain;
    /** When the event scopes to a tenant, the dashboard filters by this. */
    tenantId?: SorcUUID;
    actorUserId?: SorcUUID;
    targetUserId?: SorcUUID;
    summary: string;
    occurredAt: Date;
    streamRef: string;
};

export type ActivityListenEvents = readonly [
    { readonly name: 'TenantCreated'; readonly version: '*' },
    { readonly name: 'TenantRenamed'; readonly version: '*' },
    { readonly name: 'TenantArchived'; readonly version: '*' },
    { readonly name: 'MemberInvited'; readonly version: '*' },
    { readonly name: 'InvitationAccepted'; readonly version: '*' },
    { readonly name: 'MemberRoleChanged'; readonly version: '*' },
    { readonly name: 'MemberRemoved'; readonly version: '*' },
    { readonly name: 'ImpersonationStarted'; readonly version: '*' },
    { readonly name: 'ImpersonationEnded'; readonly version: '*' },
    { readonly name: 'AdminActionTaken'; readonly version: '*' },
    { readonly name: 'AdminGranted'; readonly version: '*' },
    { readonly name: 'AdminRemoved'; readonly version: '*' },
];

export const activityListen: ActivityListenEvents = [
    { name: 'TenantCreated', version: '*' },
    { name: 'TenantRenamed', version: '*' },
    { name: 'TenantArchived', version: '*' },
    { name: 'MemberInvited', version: '*' },
    { name: 'InvitationAccepted', version: '*' },
    { name: 'MemberRoleChanged', version: '*' },
    { name: 'MemberRemoved', version: '*' },
    { name: 'ImpersonationStarted', version: '*' },
    { name: 'ImpersonationEnded', version: '*' },
    { name: 'AdminActionTaken', version: '*' },
    { name: 'AdminGranted', version: '*' },
    { name: 'AdminRemoved', version: '*' },
] as const;

type ActivityApplyEvent = (
    | InstanceType<typeof TenantCreatedEvent>
    | InstanceType<typeof TenantRenamedEvent>
    | InstanceType<typeof TenantArchivedEvent>
    | InstanceType<typeof MemberInvitedEvent>
    | InstanceType<typeof InvitationAcceptedEvent>
    | InstanceType<typeof MemberRoleChangedEvent>
    | InstanceType<typeof MemberRemovedEvent>
    | InstanceType<typeof ImpersonationStartedEvent>
    | InstanceType<typeof ImpersonationEndedEvent>
    | InstanceType<typeof AdminActionTakenEvent>
    | InstanceType<typeof AdminGrantedEvent>
    | InstanceType<typeof AdminRemovedEvent>
) & { uuid?: string; id?: string };

function eventIdOf(event: ActivityApplyEvent): string {
    return event.uuid ?? event.id ?? `${event.stream}-${event.revision}`;
}

export function activityKey(event: ActivityApplyEvent) {
    return { eventId: eventIdOf(event) };
}

export function activityApply(
    state: ActivityDoc | null,
    event: ActivityApplyEvent,
): ActivityDoc | null {
    if (state) return state; // append-only: never mutate a row.

    const eventId = eventIdOf(event);
    const streamRef = String(event.stream);

    switch (event.name) {
        case 'TenantCreated':
            return {
                eventId,
                eventName: 'TenantCreated',
                domain: 'tenants',
                tenantId: event.payload.tenantId,
                actorUserId: event.payload.createdByUserId,
                summary: `Tenant "${event.payload.displayName}" created`,
                occurredAt: event.payload.createdAt,
                streamRef,
            };
        case 'TenantRenamed':
            return {
                eventId,
                eventName: 'TenantRenamed',
                domain: 'tenants',
                tenantId: event.payload.tenantId,
                actorUserId: event.payload.renamedByUserId,
                summary: `Tenant renamed to "${event.payload.displayName}"`,
                occurredAt: event.payload.renamedAt,
                streamRef,
            };
        case 'TenantArchived':
            return {
                eventId,
                eventName: 'TenantArchived',
                domain: 'tenants',
                tenantId: event.payload.tenantId,
                actorUserId: event.payload.archivedByUserId,
                summary: 'Tenant archived',
                occurredAt: event.payload.archivedAt,
                streamRef,
            };
        case 'MemberInvited':
            return {
                eventId,
                eventName: 'MemberInvited',
                domain: 'tenants',
                tenantId: event.payload.tenantId,
                actorUserId: event.payload.invitedByUserId,
                summary: `Invited ${event.payload.invitedEmail} as ${event.payload.role}`,
                occurredAt: event.payload.invitedAt,
                streamRef,
            };
        case 'InvitationAccepted':
            return {
                eventId,
                eventName: 'InvitationAccepted',
                domain: 'tenants',
                tenantId: event.payload.tenantId,
                actorUserId: event.payload.userId,
                targetUserId: event.payload.userId,
                summary: `${event.payload.displayName} joined`,
                occurredAt: event.payload.acceptedAt,
                streamRef,
            };
        case 'MemberRoleChanged':
            return {
                eventId,
                eventName: 'MemberRoleChanged',
                domain: 'tenants',
                tenantId: event.payload.tenantId,
                actorUserId: event.payload.changedByUserId,
                summary: `Role changed to ${event.payload.role}`,
                occurredAt: event.payload.changedAt,
                streamRef,
            };
        case 'MemberRemoved':
            return {
                eventId,
                eventName: 'MemberRemoved',
                domain: 'tenants',
                tenantId: event.payload.tenantId,
                actorUserId: event.payload.removedByUserId,
                summary: 'Member removed',
                occurredAt: event.payload.removedAt,
                streamRef,
            };
        case 'ImpersonationStarted':
            return {
                eventId,
                eventName: 'ImpersonationStarted',
                domain: 'admin',
                actorUserId: event.payload.actorAdminId,
                targetUserId: event.payload.targetUserId,
                summary: `Admin impersonating ${event.payload.targetEmail}`,
                occurredAt: event.payload.startedAt,
                streamRef,
            };
        case 'ImpersonationEnded':
            return {
                eventId,
                eventName: 'ImpersonationEnded',
                domain: 'admin',
                actorUserId: event.payload.actorAdminId,
                targetUserId: event.payload.targetUserId,
                summary: 'Impersonation ended',
                occurredAt: event.payload.endedAt,
                streamRef,
            };
        case 'AdminActionTaken':
            return {
                eventId,
                eventName: 'AdminActionTaken',
                domain: 'admin',
                actorUserId: event.payload.actorAdminId,
                summary: `Admin action: ${event.payload.action}`,
                occurredAt: event.payload.occurredAt,
                streamRef,
            };
        case 'AdminGranted':
            return {
                eventId,
                eventName: 'AdminGranted',
                domain: 'admin',
                actorUserId: event.payload.grantedByUserId,
                targetUserId: event.payload.userId,
                summary: 'Platform admin granted',
                occurredAt: event.payload.grantedAt,
                streamRef,
            };
        case 'AdminRemoved':
            return {
                eventId,
                eventName: 'AdminRemoved',
                domain: 'admin',
                actorUserId: event.payload.removedByUserId,
                targetUserId: event.payload.userId,
                summary: 'Platform admin removed',
                occurredAt: event.payload.removedAt,
                streamRef,
            };
        default:
            return state;
    }
}
