import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    UserCreatedEvent,
    UserProfileUpdatedEvent,
    UserDeletedEvent,
    UserDefaultCurrencyChangedEvent,
    UserTenantSelectorPrefChangedEvent,
    type UserStreamInstance,
} from './user.events';

export type TenantSelectorMode = 'list' | 'dropdown' | 'threshold';

export type TenantSelectorPref = {
    mode: TenantSelectorMode;
    threshold?: number;
};

export type UserState = null | {
    userId: SorcUUID;
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
    defaultCurrency?: string;
    tenantSelectorPref?: TenantSelectorPref;
    createdAt: Date;
    updatedAt?: Date;
    deletedAt?: Date;
};

export type UserEvent = InstanceType<
    | typeof UserCreatedEvent
    | typeof UserProfileUpdatedEvent
    | typeof UserDeletedEvent
    | typeof UserDefaultCurrencyChangedEvent
    | typeof UserTenantSelectorPrefChangedEvent
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
        case 'UserDefaultCurrencyChanged':
            return state
                ? { ...state, defaultCurrency: event.payload.currency }
                : state;
        case 'UserTenantSelectorPrefChanged':
            return state
                ? {
                      ...state,
                      tenantSelectorPref: {
                          mode: event.payload.mode as TenantSelectorMode,
                          threshold: event.payload.threshold,
                      },
                  }
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

export type SetDefaultCurrencyCmd = {
    currency: string;
    stream: UserStreamInstance;
};

export type SetTenantSelectorPrefCmd = {
    mode: TenantSelectorMode;
    threshold?: number;
    stream: UserStreamInstance;
};

const ISO_4217 = /^[A-Z]{3}$/;
const SELECTOR_MODES: readonly TenantSelectorMode[] = [
    'list',
    'dropdown',
    'threshold',
] as const;

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

    setDefaultCurrency(
        state: UserState,
        cmd: SetDefaultCurrencyCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('User does not exist');
        if (state.deletedAt) throw new Error('User is deleted');
        if (!ISO_4217.test(cmd.currency))
            throw new Error(
                'Currency must be a 3-letter ISO-4217 code (e.g. USD).',
            );
        if (state.defaultCurrency === cmd.currency) return;
        ctx!.emit(
            UserDefaultCurrencyChangedEvent,
            {
                userId: state.userId,
                currency: cmd.currency,
                changedAt: new Date(),
            } as InstanceType<typeof UserDefaultCurrencyChangedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    setTenantSelectorPref(
        state: UserState,
        cmd: SetTenantSelectorPrefCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('User does not exist');
        if (state.deletedAt) throw new Error('User is deleted');
        if (!SELECTOR_MODES.includes(cmd.mode))
            throw new Error(
                'Tenant selector mode must be list, dropdown, or threshold.',
            );
        let threshold: number | undefined;
        if (cmd.mode === 'threshold') {
            if (typeof cmd.threshold !== 'number' || !Number.isInteger(cmd.threshold))
                throw new Error('Threshold must be an integer 1–5.');
            if (cmd.threshold < 1 || cmd.threshold > 5)
                throw new Error('Threshold must be between 1 and 5.');
            threshold = cmd.threshold;
        }
        const prev = state.tenantSelectorPref;
        if (
            prev &&
            prev.mode === cmd.mode &&
            (prev.threshold ?? undefined) === threshold
        ) {
            return;
        }
        ctx!.emit(
            UserTenantSelectorPrefChangedEvent,
            {
                userId: state.userId,
                mode: cmd.mode,
                threshold,
                changedAt: new Date(),
            } as InstanceType<typeof UserTenantSelectorPrefChangedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
