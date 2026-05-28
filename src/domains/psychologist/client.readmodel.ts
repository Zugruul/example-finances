import type { SorcUUID } from '@event-sorcerer/core';
import type {
    PsychologistClientCreatedEvent,
    PsychologistClientUpdatedEvent,
    PsychologistClientArchivedEvent,
} from './client.events';

export type PsychologistClientDoc = {
    clientId: SorcUUID;
    tenantId: SorcUUID;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    intakeNotes?: string;
    createdAt: Date;
    isArchived: boolean;
};

export type PsychologistClientsListenEvents = readonly [
    { readonly name: 'PsychologistClientCreated'; readonly version: '*' },
    { readonly name: 'PsychologistClientUpdated'; readonly version: '*' },
    { readonly name: 'PsychologistClientArchived'; readonly version: '*' },
];

export const psychologistClientsListen: PsychologistClientsListenEvents = [
    { name: 'PsychologistClientCreated', version: '*' },
    { name: 'PsychologistClientUpdated', version: '*' },
    { name: 'PsychologistClientArchived', version: '*' },
] as const;

type ApplyEvent =
    | InstanceType<typeof PsychologistClientCreatedEvent>
    | InstanceType<typeof PsychologistClientUpdatedEvent>
    | InstanceType<typeof PsychologistClientArchivedEvent>;

export function psychologistClientsKey(event: ApplyEvent): {
    clientId: SorcUUID;
} {
    return { clientId: event.payload.clientId };
}

export function psychologistClientsApply(
    state: PsychologistClientDoc | null,
    event: ApplyEvent,
): PsychologistClientDoc | null {
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
