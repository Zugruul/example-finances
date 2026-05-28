import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    ClientCreatedEvent,
    ClientUpdatedEvent,
    ClientArchivedEvent,
    type ClientStreamInstance,
} from './client.events';

export type ClientState = null | {
    clientId: SorcUUID;
    tenantId: SorcUUID;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    notes?: string;
    createdByUserId: SorcUUID;
    createdAt: Date;
    isArchived: boolean;
};

export type ClientEvent = InstanceType<
    | typeof ClientCreatedEvent
    | typeof ClientUpdatedEvent
    | typeof ClientArchivedEvent
>;

export function clientReducer(
    state: ClientState,
    event: ClientEvent,
): ClientState {
    switch (event.name) {
        case 'ClientCreated':
            return {
                clientId: event.payload.clientId,
                tenantId: event.payload.tenantId,
                firstName: event.payload.firstName,
                lastName: event.payload.lastName,
                email: event.payload.email,
                phone: event.payload.phone,
                address: event.payload.address,
                dateOfBirth: event.payload.dateOfBirth,
                notes: event.payload.notes,
                createdByUserId: event.payload.createdByUserId,
                createdAt: event.payload.createdAt,
                isArchived: false,
            };
        case 'ClientUpdated':
            if (!state) return state;
            return {
                ...state,
                firstName:
                    event.payload.firstName !== undefined
                        ? event.payload.firstName
                        : state.firstName,
                lastName:
                    event.payload.lastName !== undefined
                        ? event.payload.lastName
                        : state.lastName,
                email:
                    event.payload.email !== undefined
                        ? event.payload.email
                        : state.email,
                phone:
                    event.payload.phone !== undefined
                        ? event.payload.phone
                        : state.phone,
                address:
                    event.payload.address !== undefined
                        ? event.payload.address
                        : state.address,
                dateOfBirth:
                    event.payload.dateOfBirth !== undefined
                        ? event.payload.dateOfBirth
                        : state.dateOfBirth,
                notes:
                    event.payload.notes !== undefined
                        ? event.payload.notes
                        : state.notes,
            };
        case 'ClientArchived':
            return state ? { ...state, isArchived: true } : state;
        default:
            return state;
    }
}

export type CreateClientCmd = {
    clientId: SorcUUID;
    tenantId: SorcUUID;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    notes?: string;
    createdByUserId: SorcUUID;
    stream: ClientStreamInstance;
};

export type UpdateClientCmd = {
    tenantId: SorcUUID;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    notes?: string;
    updatedByUserId: SorcUUID;
    stream: ClientStreamInstance;
};

export type ArchiveClientCmd = {
    tenantId: SorcUUID;
    archivedByUserId: SorcUUID;
    stream: ClientStreamInstance;
};

export const clientCommands = {
    createClient(
        state: ClientState,
        cmd: CreateClientCmd,
        ctx?: CommandContext,
    ): void {
        if (state) throw new Error(`Client ${cmd.clientId} already exists`);
        if (!cmd.firstName.trim() || !cmd.lastName.trim()) {
            throw new Error('First and last name required.');
        }
        ctx!.emit(
            ClientCreatedEvent,
            {
                clientId: cmd.clientId,
                tenantId: cmd.tenantId,
                firstName: cmd.firstName,
                lastName: cmd.lastName,
                email: cmd.email,
                phone: cmd.phone,
                address: cmd.address,
                dateOfBirth: cmd.dateOfBirth,
                notes: cmd.notes,
                createdByUserId: cmd.createdByUserId,
                createdAt: new Date(),
            } as InstanceType<typeof ClientCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    updateClient(
        state: ClientState,
        cmd: UpdateClientCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Client does not exist');
        if (state.isArchived) throw new Error('Client is archived');
        ctx!.emit(
            ClientUpdatedEvent,
            {
                clientId: state.clientId,
                tenantId: state.tenantId,
                firstName: cmd.firstName,
                lastName: cmd.lastName,
                email: cmd.email,
                phone: cmd.phone,
                address: cmd.address,
                dateOfBirth: cmd.dateOfBirth,
                notes: cmd.notes,
                updatedByUserId: cmd.updatedByUserId,
                updatedAt: new Date(),
            } as InstanceType<typeof ClientUpdatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    archiveClient(
        state: ClientState,
        cmd: ArchiveClientCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Client does not exist');
        if (state.isArchived) throw new Error('Client already archived');
        ctx!.emit(
            ClientArchivedEvent,
            {
                clientId: state.clientId,
                tenantId: state.tenantId,
                archivedByUserId: cmd.archivedByUserId,
                archivedAt: new Date(),
            } as InstanceType<typeof ClientArchivedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
