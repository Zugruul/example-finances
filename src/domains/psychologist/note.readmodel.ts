import type { SorcUUID } from '@event-sorcerer/core';
import type {
    PsychologistNoteCreatedEvent,
    PsychologistNoteUpdatedEvent,
    PsychologistNoteLockedEvent,
} from './note.events';

export type PsychologistNoteDoc = {
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

export type PsychologistNotesListenEvents = readonly [
    { readonly name: 'PsychologistNoteCreated'; readonly version: '*' },
    { readonly name: 'PsychologistNoteUpdated'; readonly version: '*' },
    { readonly name: 'PsychologistNoteLocked'; readonly version: '*' },
];

export const psychologistNotesListen: PsychologistNotesListenEvents = [
    { name: 'PsychologistNoteCreated', version: '*' },
    { name: 'PsychologistNoteUpdated', version: '*' },
    { name: 'PsychologistNoteLocked', version: '*' },
] as const;

type ApplyEvent =
    | InstanceType<typeof PsychologistNoteCreatedEvent>
    | InstanceType<typeof PsychologistNoteUpdatedEvent>
    | InstanceType<typeof PsychologistNoteLockedEvent>;

export function psychologistNotesKey(event: ApplyEvent): {
    noteId: SorcUUID;
} {
    return { noteId: event.payload.noteId };
}

export function psychologistNotesApply(
    state: PsychologistNoteDoc | null,
    event: ApplyEvent,
): PsychologistNoteDoc | null {
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
