import type { SorcUUID } from '@event-sorcerer/core';
import type {
    CommunicationReminderScheduledEvent,
    CommunicationReminderSentEvent,
    CommunicationReminderFailedEvent,
    CommunicationReminderCancelledEvent,
    CommunicationReminderStatus,
} from './reminder.events';
import type { CommunicationChannel } from './integration.events';

export type CommunicationReminderDoc = {
    reminderId: SorcUUID;
    tenantId: SorcUUID;
    sendAt: Date;
    channel: CommunicationChannel;
    integrationId?: SorcUUID;
    recipientLabel: string;
    message: string;
    linkedEntityKind?: string;
    linkedEntityId?: SorcUUID;
    status: CommunicationReminderStatus;
    providerMessageId?: string;
    failureReason?: string;
    sentAt?: Date;
    cancelledAt?: Date;
};

export type CommunicationRemindersListenEvents = readonly [
    {
        readonly name: 'CommunicationReminderScheduled';
        readonly version: '*';
    },
    { readonly name: 'CommunicationReminderSent'; readonly version: '*' },
    {
        readonly name: 'CommunicationReminderFailed';
        readonly version: '*';
    },
    {
        readonly name: 'CommunicationReminderCancelled';
        readonly version: '*';
    },
];

export const communicationRemindersListen: CommunicationRemindersListenEvents =
    [
        { name: 'CommunicationReminderScheduled', version: '*' },
        { name: 'CommunicationReminderSent', version: '*' },
        { name: 'CommunicationReminderFailed', version: '*' },
        { name: 'CommunicationReminderCancelled', version: '*' },
    ] as const;

type ApplyEvent =
    | InstanceType<typeof CommunicationReminderScheduledEvent>
    | InstanceType<typeof CommunicationReminderSentEvent>
    | InstanceType<typeof CommunicationReminderFailedEvent>
    | InstanceType<typeof CommunicationReminderCancelledEvent>;

export function communicationRemindersKey(event: ApplyEvent): {
    reminderId: SorcUUID;
} {
    return { reminderId: event.payload.reminderId };
}

export function communicationRemindersApply(
    state: CommunicationReminderDoc | null,
    event: ApplyEvent,
): CommunicationReminderDoc | null {
    switch (event.name) {
        case 'CommunicationReminderScheduled': {
            const p = event.payload;
            return {
                reminderId: p.reminderId,
                tenantId: p.tenantId,
                sendAt: p.sendAt,
                channel: p.channel,
                integrationId: p.integrationId,
                recipientLabel: p.recipientLabel,
                message: p.message,
                linkedEntityKind: p.linkedEntityKind,
                linkedEntityId: p.linkedEntityId,
                status: 'scheduled',
            };
        }
        case 'CommunicationReminderSent':
            return state
                ? {
                      ...state,
                      status: 'sent',
                      sentAt: event.payload.sentAt,
                      integrationId: event.payload.integrationId,
                      providerMessageId: event.payload.providerMessageId,
                  }
                : state;
        case 'CommunicationReminderFailed':
            return state
                ? {
                      ...state,
                      status: 'failed',
                      failureReason: event.payload.reason,
                  }
                : state;
        case 'CommunicationReminderCancelled':
            return state
                ? {
                      ...state,
                      status: 'cancelled',
                      cancelledAt: event.payload.cancelledAt,
                  }
                : state;
        default:
            return state;
    }
}
