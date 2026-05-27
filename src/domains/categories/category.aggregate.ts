import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    CategoryCreatedEvent,
    CategoryRenamedEvent,
    CategoryReparentedEvent,
    CategoryColorChangedEvent,
    CategoryArchivedEvent,
    type CategoryStreamInstance,
    type CategoryType,
} from './category.events';

export type CategoryState = null | {
    categoryId: SorcUUID;
    tenantId: SorcUUID;
    name: string;
    categoryType: CategoryType;
    parentId?: SorcUUID;
    color?: string;
    icon?: string;
    createdByUserId: SorcUUID;
    createdAt: Date;
    isArchived: boolean;
};

export type CategoryEvent = InstanceType<
    | typeof CategoryCreatedEvent
    | typeof CategoryRenamedEvent
    | typeof CategoryReparentedEvent
    | typeof CategoryColorChangedEvent
    | typeof CategoryArchivedEvent
>;

export function categoryReducer(
    state: CategoryState,
    event: CategoryEvent,
): CategoryState {
    switch (event.name) {
        case 'CategoryCreated':
            return {
                categoryId: event.payload.categoryId,
                tenantId: event.payload.tenantId,
                name: event.payload.name,
                categoryType: event.payload.categoryType,
                parentId: event.payload.parentId,
                color: event.payload.color,
                icon: event.payload.icon,
                createdByUserId: event.payload.createdByUserId,
                createdAt: event.payload.createdAt,
                isArchived: false,
            };
        case 'CategoryRenamed':
            return state ? { ...state, name: event.payload.name } : state;
        case 'CategoryReparented':
            return state
                ? { ...state, parentId: event.payload.parentId }
                : state;
        case 'CategoryColorChanged':
            return state
                ? {
                      ...state,
                      color: event.payload.color,
                      icon: event.payload.icon,
                  }
                : state;
        case 'CategoryArchived':
            return state ? { ...state, isArchived: true } : state;
        default:
            return state;
    }
}

// ----- command inputs -----

export type CreateCategoryCmd = {
    categoryId: SorcUUID;
    tenantId: SorcUUID;
    name: string;
    categoryType: CategoryType;
    parentId?: SorcUUID;
    color?: string;
    icon?: string;
    createdByUserId: SorcUUID;
    stream: CategoryStreamInstance;
};

export type RenameCategoryCmd = {
    name: string;
    renamedByUserId: SorcUUID;
    stream: CategoryStreamInstance;
};

export type ReparentCategoryCmd = {
    parentId?: SorcUUID;
    reparentedByUserId: SorcUUID;
    stream: CategoryStreamInstance;
};

export type ChangeCategoryColorCmd = {
    color?: string;
    icon?: string;
    changedByUserId: SorcUUID;
    stream: CategoryStreamInstance;
};

export type ArchiveCategoryCmd = {
    archivedByUserId: SorcUUID;
    stream: CategoryStreamInstance;
};

// ----- commands -----

export const categoryCommands = {
    createCategory(
        state: CategoryState,
        cmd: CreateCategoryCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(`Category ${cmd.categoryId} already exists`);
        ctx!.emit(
            CategoryCreatedEvent,
            {
                categoryId: cmd.categoryId,
                tenantId: cmd.tenantId,
                name: cmd.name,
                categoryType: cmd.categoryType,
                parentId: cmd.parentId,
                color: cmd.color,
                icon: cmd.icon,
                createdByUserId: cmd.createdByUserId,
                createdAt: new Date(),
            } as InstanceType<typeof CategoryCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    renameCategory(
        state: CategoryState,
        cmd: RenameCategoryCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Category does not exist');
        if (state.isArchived) throw new Error('Category is archived');
        ctx!.emit(
            CategoryRenamedEvent,
            {
                categoryId: state.categoryId,
                name: cmd.name,
                renamedByUserId: cmd.renamedByUserId,
                renamedAt: new Date(),
            } as InstanceType<typeof CategoryRenamedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    reparentCategory(
        state: CategoryState,
        cmd: ReparentCategoryCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Category does not exist');
        if (state.isArchived) throw new Error('Category is archived');
        // Cycle-prevention is enforced at the server-action boundary
        // (the action walks the parent chain via the read model and
        // refuses the publish). The aggregate cannot do that walk
        // itself — it sees one stream at a time.
        ctx!.emit(
            CategoryReparentedEvent,
            {
                categoryId: state.categoryId,
                parentId: cmd.parentId,
                reparentedByUserId: cmd.reparentedByUserId,
                reparentedAt: new Date(),
            } as InstanceType<typeof CategoryReparentedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    changeCategoryColor(
        state: CategoryState,
        cmd: ChangeCategoryColorCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Category does not exist');
        if (state.isArchived) throw new Error('Category is archived');
        ctx!.emit(
            CategoryColorChangedEvent,
            {
                categoryId: state.categoryId,
                color: cmd.color,
                icon: cmd.icon,
                changedByUserId: cmd.changedByUserId,
                changedAt: new Date(),
            } as InstanceType<typeof CategoryColorChangedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    archiveCategory(
        state: CategoryState,
        cmd: ArchiveCategoryCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Category does not exist');
        if (state.isArchived) throw new Error('Category already archived');
        ctx!.emit(
            CategoryArchivedEvent,
            {
                categoryId: state.categoryId,
                archivedByUserId: cmd.archivedByUserId,
                archivedAt: new Date(),
            } as InstanceType<typeof CategoryArchivedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
