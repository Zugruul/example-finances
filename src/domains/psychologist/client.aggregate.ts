import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    PsychologistClientCreatedEvent,
    PsychologistClientUpdatedEvent,
    PsychologistClientArchivedEvent,
    type PsychologistClientStreamInstance,
} from './client.events';

export type PsychologistClientState = null | {
    clientId: SorcUUID;
    tenantId: SorcUUID;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    intakeNotes?: string;
    createdByUserId: SorcUUID;
    createdAt: Date;
    isArchived: boolean;
};

export type PsychologistClientEvent = InstanceType<
    | typeof PsychologistClientCreatedEvent
    | typeof PsychologistClientUpdatedEvent
    | typeof PsychologistClientArchivedEvent
>;

export function psychologistClientReducer(
    state: PsychologistClientState,
    event: PsychologistClientEvent,
): PsychologistClientState {
    switch (event.name) {
        case 'PsychologistClientCreated': {
            const p = event.payload;
            return {
                clientId: p.clientId,
                tenantId: p.tenantId,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
                phone: p.phone,
                address: p.address,
                dateOfBirth: p.dateOfBirth,
                intakeNotes: p.intakeNotes,
                createdByUserId: p.createdByUserId,
                createdAt: p.createdAt,
                isArchived: false,
            };
        }
        case 'PsychologistClientUpdated': {
            if (!state) return state;
            const p = event.payload;
            return {
                ...state,
                firstName:
                    p.firstName !== undefined ? p.firstName : state.firstName,
                lastName:
                    p.lastName !== undefined ? p.lastName : state.lastName,
                email: p.email !== undefined ? p.email : state.email,
                phone: p.phone !== undefined ? p.phone : state.phone,
                address: p.address !== undefined ? p.address : state.address,
                dateOfBirth:
                    p.dateOfBirth !== undefined
                        ? p.dateOfBirth
                        : state.dateOfBirth,
                intakeNotes:
                    p.intakeNotes !== undefined
                        ? p.intakeNotes
                        : state.intakeNotes,
            };
        }
        case 'PsychologistClientArchived':
            return state ? { ...state, isArchived: true } : state;
        default:
            return state;
    }
}

export type CreatePsychologistClientCmd = {
    clientId: SorcUUID;
    tenantId: SorcUUID;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    intakeNotes?: string;
    createdByUserId: SorcUUID;
    stream: PsychologistClientStreamInstance;
};

export type UpdatePsychologistClientCmd = {
    tenantId: SorcUUID;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    intakeNotes?: string;
    updatedByUserId: SorcUUID;
    stream: PsychologistClientStreamInstance;
};

export type ArchivePsychologistClientCmd = {
    tenantId: SorcUUID;
    archivedByUserId: SorcUUID;
    stream: PsychologistClientStreamInstance;
};

export const psychologistClientCommands = {
    createPsychologistClient(
        state: PsychologistClientState,
        cmd: CreatePsychologistClientCmd,
        ctx?: CommandContext,
    ): void {
        if (state) throw new Error(`Client ${cmd.clientId} already exists`);
        if (!cmd.firstName.trim() || !cmd.lastName.trim()) {
            throw new Error('First and last name required.');
        }
        ctx!.emit(
            PsychologistClientCreatedEvent,
            {
                clientId: cmd.clientId,
                tenantId: cmd.tenantId,
                firstName: cmd.firstName,
                lastName: cmd.lastName,
                email: cmd.email,
                phone: cmd.phone,
                address: cmd.address,
                dateOfBirth: cmd.dateOfBirth,
                intakeNotes: cmd.intakeNotes,
                createdByUserId: cmd.createdByUserId,
                createdAt: new Date(),
            } as InstanceType<
                typeof PsychologistClientCreatedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    updatePsychologistClient(
        state: PsychologistClientState,
        cmd: UpdatePsychologistClientCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Client does not exist');
        if (state.isArchived) throw new Error('Client is archived');
        ctx!.emit(
            PsychologistClientUpdatedEvent,
            {
                clientId: state.clientId,
                tenantId: state.tenantId,
                firstName: cmd.firstName,
                lastName: cmd.lastName,
                email: cmd.email,
                phone: cmd.phone,
                address: cmd.address,
                dateOfBirth: cmd.dateOfBirth,
                intakeNotes: cmd.intakeNotes,
                updatedByUserId: cmd.updatedByUserId,
                updatedAt: new Date(),
            } as InstanceType<
                typeof PsychologistClientUpdatedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
    archivePsychologistClient(
        state: PsychologistClientState,
        cmd: ArchivePsychologistClientCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Client does not exist');
        if (state.isArchived) throw new Error('Client already archived');
        ctx!.emit(
            PsychologistClientArchivedEvent,
            {
                clientId: state.clientId,
                tenantId: state.tenantId,
                archivedByUserId: cmd.archivedByUserId,
                archivedAt: new Date(),
            } as InstanceType<
                typeof PsychologistClientArchivedEvent
            >['payload'],
            { stream: cmd.stream },
        );
    },
};
