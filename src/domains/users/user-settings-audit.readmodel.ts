import type { SorcUUID } from '@event-sorcerer/core';
import {
    type UserProfileUpdatedEvent,
    type UserDefaultCurrencyChangedEvent,
    type UserTenantSelectorPrefChangedEvent,
} from './user.events';

/**
 * `userSettingsAudit` — one doc per setting-change event on the User
 * aggregate. Keyed by event uuid so every change is an append-only row.
 * Lifecycle events (`UserCreated`, `UserDeleted`) are deliberately
 * excluded — those are profile lifecycle, not user-driven setting
 * changes.
 *
 * Surfaced on `/settings/audit` for the signed-in user; not used for
 * cross-user audit (that would belong to admin tooling).
 */
export type UserSettingsAuditDoc = {
    eventId: string;
    userId: SorcUUID;
    kind:
        | 'UserProfileUpdated'
        | 'UserDefaultCurrencyChanged'
        | 'UserTenantSelectorPrefChanged';
    /**
     * Payload sans `userId` and the canonical timestamp field for the
     * event — what actually changed. Rendered verbatim in the audit
     * page's collapsible `<details>` for power users.
     */
    changes: Record<string, unknown>;
    occurredAt: Date;
};

export type UserSettingsAuditListenEvents = readonly [
    { readonly name: 'UserProfileUpdated'; readonly version: '*' },
    { readonly name: 'UserDefaultCurrencyChanged'; readonly version: '*' },
    { readonly name: 'UserTenantSelectorPrefChanged'; readonly version: '*' },
];

export const userSettingsAuditListen: UserSettingsAuditListenEvents = [
    { name: 'UserProfileUpdated', version: '*' },
    { name: 'UserDefaultCurrencyChanged', version: '*' },
    { name: 'UserTenantSelectorPrefChanged', version: '*' },
] as const;

type UserSettingsAuditApplyEvent = (
    | InstanceType<typeof UserProfileUpdatedEvent>
    | InstanceType<typeof UserDefaultCurrencyChangedEvent>
    | InstanceType<typeof UserTenantSelectorPrefChangedEvent>
) & { uuid?: string; id?: string };

export function userSettingsAuditKey(event: UserSettingsAuditApplyEvent) {
    return {
        eventId: event.uuid ?? event.id ?? `${event.stream}-${event.revision}`,
    };
}

export function userSettingsAuditApply(
    state: UserSettingsAuditDoc | null,
    event: UserSettingsAuditApplyEvent,
): UserSettingsAuditDoc | null {
    if (state) return state; // append-only — never mutate existing rows.

    const eventId =
        event.uuid ?? event.id ?? `${event.stream}-${event.revision}`;

    switch (event.name) {
        case 'UserProfileUpdated': {
            const { userId, updatedAt, ...changes } = event.payload;
            return {
                eventId,
                userId,
                kind: 'UserProfileUpdated',
                changes,
                occurredAt: updatedAt,
            };
        }
        case 'UserDefaultCurrencyChanged': {
            const { userId, changedAt, ...changes } = event.payload;
            return {
                eventId,
                userId,
                kind: 'UserDefaultCurrencyChanged',
                changes,
                occurredAt: changedAt,
            };
        }
        case 'UserTenantSelectorPrefChanged': {
            const { userId, changedAt, ...changes } = event.payload;
            return {
                eventId,
                userId,
                kind: 'UserTenantSelectorPrefChanged',
                changes,
                occurredAt: changedAt,
            };
        }
        default:
            return state;
    }
}
