import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    UserCreatedEvent,
    UserProfileUpdatedEvent,
    UserDeletedEvent,
    type UserStreamInstance,
} from './user.events';

export type UserState = null | {
    userId: SorcUUID;
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
    createdAt: Date;
    updatedAt?: Date;
    deletedAt?: Date;
};

export type UserEvent = InstanceType<
    | typeof UserCreatedEvent
    | typeof UserProfileUpdatedEvent
    | typeof UserDeletedEvent
>;

export function userReducer(state: UserState, event: UserEvent): UserState {
    switch (event.name) {
        case 'UserCreated':
            return {
                userId: event.payload.userId,
                email: event.payload.email,
                createdAt: event.payload.createdAt,
            };
        case 'UserProfileUpdated':
            return state
                ? {
                      ...state,
                      firstName: event.payload.firstName ?? state.firstName,
                      lastName: event.payload.lastName ?? state.lastName,
                      phoneNumber:
                          event.payload.phoneNumber ?? state.phoneNumber,
                      address: event.payload.address ?? state.address,
                      updatedAt: event.payload.updatedAt,
                  }
                : state;
        case 'UserDeleted':
            return state
                ? { ...state, deletedAt: event.payload.deletedAt }
                : state;
        default:
            return state;
    }
}

// ----- command inputs -----

export type CreateUserCmd = {
    userId: SorcUUID;
    email: string;
    stream: UserStreamInstance;
};

export type UpdateProfileCmd = {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
    stream: UserStreamInstance;
};

export type DeleteUserCmd = {
    stream: UserStreamInstance;
};

// ----- commands -----

export const userCommands = {
    createUser(
        state: UserState,
        cmd: CreateUserCmd,
        ctx?: CommandContext,
    ): void {
        if (state) throw new Error(`User ${cmd.userId} already exists`);
        ctx!.emit(
            UserCreatedEvent,
            {
                userId: cmd.userId,
                email: cmd.email,
                createdAt: new Date(),
            } as InstanceType<typeof UserCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    updateProfile(
        state: UserState,
        cmd: UpdateProfileCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('User does not exist');
        if (state.deletedAt) throw new Error('User is deleted');
        ctx!.emit(
            UserProfileUpdatedEvent,
            {
                userId: state.userId,
                firstName: cmd.firstName,
                lastName: cmd.lastName,
                phoneNumber: cmd.phoneNumber,
                address: cmd.address,
                updatedAt: new Date(),
            } as InstanceType<typeof UserProfileUpdatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    deleteUser(
        state: UserState,
        cmd: DeleteUserCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('User does not exist');
        if (state.deletedAt) throw new Error('User already deleted');
        ctx!.emit(
            UserDeletedEvent,
            {
                userId: state.userId,
                deletedAt: new Date(),
            } as InstanceType<typeof UserDeletedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
