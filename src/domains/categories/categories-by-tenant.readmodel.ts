import type { SorcUUID } from '@event-sorcerer/core';
import {
    type CategoryCreatedEvent,
    type CategoryRenamedEvent,
    type CategoryReparentedEvent,
    type CategoryColorChangedEvent,
    type CategoryArchivedEvent,
    type CategoryType,
} from './category.events';

export type CategoryDoc = {
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

export type CategoriesByTenantListenEvents = readonly [
    { readonly name: 'CategoryCreated'; readonly version: '*' },
    { readonly name: 'CategoryRenamed'; readonly version: '*' },
    { readonly name: 'CategoryReparented'; readonly version: '*' },
    { readonly name: 'CategoryColorChanged'; readonly version: '*' },
    { readonly name: 'CategoryArchived'; readonly version: '*' },
];

export const categoriesByTenantListen: CategoriesByTenantListenEvents = [
    { name: 'CategoryCreated', version: '*' },
    { name: 'CategoryRenamed', version: '*' },
    { name: 'CategoryReparented', version: '*' },
    { name: 'CategoryColorChanged', version: '*' },
    { name: 'CategoryArchived', version: '*' },
] as const;

type CategoriesApplyEvent =
    | InstanceType<typeof CategoryCreatedEvent>
    | InstanceType<typeof CategoryRenamedEvent>
    | InstanceType<typeof CategoryReparentedEvent>
    | InstanceType<typeof CategoryColorChangedEvent>
    | InstanceType<typeof CategoryArchivedEvent>;

export function categoriesByTenantKey(event: CategoriesApplyEvent) {
    return { categoryId: event.payload.categoryId };
}

export function categoriesByTenantApply(
    state: CategoryDoc | null,
    event: CategoriesApplyEvent,
): CategoryDoc | null {
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
