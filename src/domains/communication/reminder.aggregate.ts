import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    CommunicationReminderScheduledEvent,
    CommunicationReminderSentEvent,
    CommunicationReminderFailedEvent,
    CommunicationReminderCancelledEvent,
    type CommunicationReminderStreamInstance,
    type CommunicationReminderStatus,
} from './reminder.events';
import type { CommunicationChannel } from './integration.events';

export type CommunicationReminderState = null | {
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
};

export type CommunicationReminderEvent = InstanceType<
    | typeof CommunicationReminderScheduledEvent
    | typeof CommunicationReminderSentEvent
    | typeof CommunicationReminderFailedEvent
    | typeof CommunicationReminderCancelledEvent
>;

export function communicationReminderReducer(
    state: CommunicationReminderState,
    event: CommunicationReminderEvent,
): CommunicationReminderState {
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
                      integrationId: event.payload.integrationId,
                  }
                : state;
        case 'CommunicationReminderFailed':
            return state ? { ...state, status: 'failed' } : state;
        case 'CommunicationReminderCancelled':
            return state ? { ...state, status: 'cancelled' } : state;
        default:
            return state;
    }
}

export type ScheduleCommunicationReminderCmd = {
    reminderId: SorcUUID;
    tenantId: SorcUUID;
    sendAt: Date;
    channel: CommunicationChannel;
    integrationId?: SorcUUID;
    recipientLabel: string;
    message: string;
    linkedEntityKind?: string;
    linkedEntityId?: SorcUUID;
    scheduledByUserId: SorcUUID;
    stream: CommunicationReminderStreamInstance;
};

export type MarkCommunicationReminderSentCmd = {
    tenantId: SorcUUID;
    integrationId: SorcUUID;
    providerMessageId?: string;
    stream: CommunicationReminderStreamInstance;
};

export type MarkCommunicationReminderFailedCmd = {
    tenantId: SorcUUID;
    reason: string;
    stream: CommunicationReminderStreamInstance;
};

export type CancelCommunicationReminderCmd = {
    tenantId: SorcUUID;
    cancelledByUserId: SorcUUID;
    reason?: string;
    stream: CommunicationReminderStreamInstance;
};

export const communicationReminderCommands = {
    scheduleCommunicationReminder(
        state: CommunicationReminderState,
        cmd: ScheduleCommunicationReminderCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(`Reminder ${cmd.reminderId} already exists`);
        if (!cmd.message.trim()) throw new Error('Message required.');
        ctx!.emit(
            CommunicationReminderScheduledEvent,
            {
                reminderId: cmd.reminderId,
                tenantId: cmd.tenantId,
                sendAt: cmd.sendAt,
                channel: cmd.channel,
                integrationId: cmd.integrationId,
                recipientLabel: cmd.recipientLabel,
                message: cmd.message,
                linkedEntityKind: cmd.linkedEntityKind,
                linkedEntityId: cmd.linkedEntityId,
                scheduledByUserId: cmd.scheduledByUserId,
                scheduledAt: new Date(),
            } as InstanceType<
                typeof CommunicationReminderScheduledEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    markCommunicationReminderSent(
        state: CommunicationReminderState,
        cmd: MarkCommunicationReminderSentCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Reminder does not exist');
        if (state.status !== 'scheduled') return;
        ctx!.emit(
            CommunicationReminderSentEvent,
            {
                reminderId: state.reminderId,
                tenantId: state.tenantId,
                integrationId: cmd.integrationId,
                providerMessageId: cmd.providerMessageId,
                sentAt: new Date(),
            } as InstanceType<
                typeof CommunicationReminderSentEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    markCommunicationReminderFailed(
        state: CommunicationReminderState,
        cmd: MarkCommunicationReminderFailedCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Reminder does not exist');
        if (state.status !== 'scheduled') return;
        ctx!.emit(
            CommunicationReminderFailedEvent,
            {
                reminderId: state.reminderId,
                tenantId: state.tenantId,
                reason: cmd.reason,
                failedAt: new Date(),
            } as InstanceType<
                typeof CommunicationReminderFailedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    cancelCommunicationReminder(
        state: CommunicationReminderState,
        cmd: CancelCommunicationReminderCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Reminder does not exist');
        if (state.status !== 'scheduled') return;
        ctx!.emit(
            CommunicationReminderCancelledEvent,
            {
                reminderId: state.reminderId,
                tenantId: state.tenantId,
                cancelledByUserId: cmd.cancelledByUserId,
                cancelledAt: new Date(),
                reason: cmd.reason,
            } as InstanceType<
                typeof CommunicationReminderCancelledEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
};
