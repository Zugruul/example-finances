import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    PsychologistNoteCreatedEvent,
    PsychologistNoteUpdatedEvent,
    PsychologistNoteLockedEvent,
    type PsychologistNoteStreamInstance,
} from './note.events';

export type PsychologistNoteState = null | {
    noteId: SorcUUID;
    tenantId: SorcUUID;
    clientId: SorcUUID;
    sessionId?: SorcUUID;
    title: string;
    body: string;
    authoredByUserId: SorcUUID;
    authoredAt: Date;
    isLocked: boolean;
};

export type PsychologistNoteEvent = InstanceType<
    | typeof PsychologistNoteCreatedEvent
    | typeof PsychologistNoteUpdatedEvent
    | typeof PsychologistNoteLockedEvent
>;

export function psychologistNoteReducer(
    state: PsychologistNoteState,
    event: PsychologistNoteEvent,
): PsychologistNoteState {
    switch (event.name) {
        case 'PsychologistNoteCreated': {
            const p = event.payload;
            return {
                noteId: p.noteId,
                tenantId: p.tenantId,
                clientId: p.clientId,
                sessionId: p.sessionId,
                title: p.title,
                body: p.body,
                authoredByUserId: p.authoredByUserId,
                authoredAt: p.authoredAt,
                isLocked: false,
            };
        }
        case 'PsychologistNoteUpdated':
            if (!state) return state;
            return {
                ...state,
                title:
                    event.payload.title !== undefined
                        ? event.payload.title
                        : state.title,
                body:
                    event.payload.body !== undefined
                        ? event.payload.body
                        : state.body,
            };
        case 'PsychologistNoteLocked':
            return state ? { ...state, isLocked: true } : state;
        default:
            return state;
    }
}

export type CreatePsychologistNoteCmd = {
    noteId: SorcUUID;
    tenantId: SorcUUID;
    clientId: SorcUUID;
    sessionId?: SorcUUID;
    title: string;
    body: string;
    authoredByUserId: SorcUUID;
    stream: PsychologistNoteStreamInstance;
};

export type UpdatePsychologistNoteCmd = {
    tenantId: SorcUUID;
    title?: string;
    body?: string;
    updatedByUserId: SorcUUID;
    stream: PsychologistNoteStreamInstance;
};

export type LockPsychologistNoteCmd = {
    tenantId: SorcUUID;
    lockedByUserId: SorcUUID;
    stream: PsychologistNoteStreamInstance;
};

export const psychologistNoteCommands = {
    createPsychologistNote(
        state: PsychologistNoteState,
        cmd: CreatePsychologistNoteCmd,
        ctx?: CommandContext,
    ): void {
        if (state) throw new Error(`Note ${cmd.noteId} already exists`);
        if (!cmd.title.trim() || !cmd.body.trim()) {
            throw new Error('Title and body required.');
        }
        ctx!.emit(
            PsychologistNoteCreatedEvent,
            {
                noteId: cmd.noteId,
                tenantId: cmd.tenantId,
                clientId: cmd.clientId,
                sessionId: cmd.sessionId,
                title: cmd.title,
                body: cmd.body,
                authoredByUserId: cmd.authoredByUserId,
                authoredAt: new Date(),
            } as InstanceType<typeof PsychologistNoteCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    updatePsychologistNote(
        state: PsychologistNoteState,
        cmd: UpdatePsychologistNoteCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Note does not exist');
        if (state.isLocked) throw new Error('Note is locked.');
        ctx!.emit(
            PsychologistNoteUpdatedEvent,
            {
                noteId: state.noteId,
                tenantId: state.tenantId,
                title: cmd.title,
                body: cmd.body,
                updatedByUserId: cmd.updatedByUserId,
                updatedAt: new Date(),
            } as InstanceType<typeof PsychologistNoteUpdatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
    lockPsychologistNote(
        state: PsychologistNoteState,
        cmd: LockPsychologistNoteCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Note does not exist');
        if (state.isLocked) return;
        ctx!.emit(
            PsychologistNoteLockedEvent,
            {
                noteId: state.noteId,
                tenantId: state.tenantId,
                lockedByUserId: cmd.lockedByUserId,
                lockedAt: new Date(),
            } as InstanceType<typeof PsychologistNoteLockedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
