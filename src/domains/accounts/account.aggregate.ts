import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    AccountCreatedEvent,
    AccountRenamedEvent,
    AccountTypeChangedEvent,
    AccountArchivedEvent,
    AccountClosedEvent,
    type AccountStreamInstance,
    type AccountType,
} from './account.events';

export type AccountState = null | {
    accountId: SorcUUID;
    tenantId: SorcUUID;
    name: string;
    accountType: AccountType;
    currency: string;
    openingBalance: number;
    createdByUserId: SorcUUID;
    createdAt: Date;
    isArchived: boolean;
    isClosed: boolean;
};

export type AccountEvent = InstanceType<
    | typeof AccountCreatedEvent
    | typeof AccountRenamedEvent
    | typeof AccountTypeChangedEvent
    | typeof AccountArchivedEvent
    | typeof AccountClosedEvent
>;

export function accountReducer(
    state: AccountState,
    event: AccountEvent,
): AccountState {
    switch (event.name) {
        case 'AccountCreated':
            return {
                accountId: event.payload.accountId,
                tenantId: event.payload.tenantId,
                name: event.payload.name,
                accountType: event.payload.accountType,
                currency: event.payload.currency,
                openingBalance: event.payload.openingBalance,
                createdByUserId: event.payload.createdByUserId,
                createdAt: event.payload.createdAt,
                isArchived: false,
                isClosed: false,
            };
        case 'AccountRenamed':
            return state ? { ...state, name: event.payload.name } : state;
        case 'AccountTypeChanged':
            return state
                ? { ...state, accountType: event.payload.accountType }
                : state;
        case 'AccountArchived':
            return state ? { ...state, isArchived: true } : state;
        case 'AccountClosed':
            return state ? { ...state, isClosed: true } : state;
        default:
            return state;
    }
}

// ----- command inputs -----

export type CreateAccountCmd = {
    accountId: SorcUUID;
    tenantId: SorcUUID;
    name: string;
    accountType: AccountType;
    currency: string;
    openingBalance: number;
    createdByUserId: SorcUUID;
    stream: AccountStreamInstance;
};

export type RenameAccountCmd = {
    name: string;
    renamedByUserId: SorcUUID;
    stream: AccountStreamInstance;
};

export type ChangeAccountTypeCmd = {
    accountType: AccountType;
    changedByUserId: SorcUUID;
    stream: AccountStreamInstance;
};

export type ArchiveAccountCmd = {
    archivedByUserId: SorcUUID;
    stream: AccountStreamInstance;
};

export type CloseAccountCmd = {
    closedByUserId: SorcUUID;
    stream: AccountStreamInstance;
};

// ----- commands -----

export const accountCommands = {
    createAccount(
        state: AccountState,
        cmd: CreateAccountCmd,
        ctx?: CommandContext,
    ): void {
        if (state) throw new Error(`Account ${cmd.accountId} already exists`);
        ctx!.emit(
            AccountCreatedEvent,
            {
                accountId: cmd.accountId,
                tenantId: cmd.tenantId,
                name: cmd.name,
                accountType: cmd.accountType,
                currency: cmd.currency,
                openingBalance: cmd.openingBalance,
                createdByUserId: cmd.createdByUserId,
                createdAt: new Date(),
            } as InstanceType<typeof AccountCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    renameAccount(
        state: AccountState,
        cmd: RenameAccountCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Account does not exist');
        if (state.isClosed) throw new Error('Account is closed');
        ctx!.emit(
            AccountRenamedEvent,
            {
                accountId: state.accountId,
                name: cmd.name,
                renamedByUserId: cmd.renamedByUserId,
                renamedAt: new Date(),
            } as InstanceType<typeof AccountRenamedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    changeAccountType(
        state: AccountState,
        cmd: ChangeAccountTypeCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Account does not exist');
        if (state.isClosed) throw new Error('Account is closed');
        ctx!.emit(
            AccountTypeChangedEvent,
            {
                accountId: state.accountId,
                accountType: cmd.accountType,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
            } as InstanceType<typeof AccountTypeChangedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    archiveAccount(
        state: AccountState,
        cmd: ArchiveAccountCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Account does not exist');
        if (state.isArchived) throw new Error('Account already archived');
        ctx!.emit(
            AccountArchivedEvent,
            {
                accountId: state.accountId,
                archivedByUserId: cmd.archivedByUserId,
                archivedAt: new Date(),
            } as InstanceType<typeof AccountArchivedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    closeAccount(
        state: AccountState,
        cmd: CloseAccountCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Account does not exist');
        if (state.isClosed) throw new Error('Account already closed');
        ctx!.emit(
            AccountClosedEvent,
            {
                accountId: state.accountId,
                closedByUserId: cmd.closedByUserId,
                closedAt: new Date(),
            } as InstanceType<typeof AccountClosedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
