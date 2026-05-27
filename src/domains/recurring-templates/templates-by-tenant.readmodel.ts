import type { SorcUUID } from '@event-sorcerer/core';
import {
    type TemplateCreatedEvent,
    type TemplateUpdatedEvent,
    type TemplateArchivedEvent,
    type TemplateMaterializedEvent,
    type TemplateType,
    type Cadence,
} from './template.events';

/** Tolerate legacy JSON-string cadence alongside the new object shape. */
function readCadence(value: unknown): Cadence {
    if (typeof value === 'string') {
        if (!value.trim()) return { kind: 'daily' };
        try {
            return JSON.parse(value) as Cadence;
        } catch {
            return { kind: 'daily' };
        }
    }
    return value as Cadence;
}

export type RecurringTemplateDoc = {
    templateId: SorcUUID;
    tenantId: SorcUUID;
    accountId: SorcUUID;
    categoryId?: SorcUUID;
    amount: number;
    description?: string;
    transactionType: TemplateType;
    cadence: Cadence;
    startsOn: string;
    endsOn?: string;
    lastMaterializedOn?: string;
    isArchived: boolean;
};

export type RecurringTemplatesListenEvents = readonly [
    { readonly name: 'TemplateCreated'; readonly version: '*' },
    { readonly name: 'TemplateUpdated'; readonly version: '*' },
    { readonly name: 'TemplateArchived'; readonly version: '*' },
    { readonly name: 'TemplateMaterialized'; readonly version: '*' },
];

export const recurringTemplatesListen: RecurringTemplatesListenEvents = [
    { name: 'TemplateCreated', version: '*' },
    { name: 'TemplateUpdated', version: '*' },
    { name: 'TemplateArchived', version: '*' },
    { name: 'TemplateMaterialized', version: '*' },
] as const;

type RTApplyEvent =
    | InstanceType<typeof TemplateCreatedEvent>
    | InstanceType<typeof TemplateUpdatedEvent>
    | InstanceType<typeof TemplateArchivedEvent>
    | InstanceType<typeof TemplateMaterializedEvent>;

export function recurringTemplatesKey(event: RTApplyEvent) {
    return { templateId: event.payload.templateId };
}

export function recurringTemplatesApply(
    state: RecurringTemplateDoc | null,
    event: RTApplyEvent,
): RecurringTemplateDoc | null {
    switch (event.name) {
        case 'TemplateCreated':
            return {
                templateId: event.payload.templateId,
                tenantId: event.payload.tenantId,
                accountId: event.payload.accountId,
                categoryId: event.payload.categoryId,
                amount: event.payload.amount,
                description: event.payload.description,
                transactionType: event.payload.transactionType,
                cadence: readCadence(event.payload.cadence),
                startsOn: event.payload.startsOn,
                endsOn: event.payload.endsOn,
                isArchived: false,
            };
        case 'TemplateUpdated':
            if (!state) return state;
            return {
                ...state,
                amount:
                    event.payload.amount !== undefined
                        ? event.payload.amount
                        : state.amount,
                description:
                    event.payload.description !== undefined
                        ? event.payload.description
                        : state.description,
                cadence:
                    event.payload.cadence !== undefined
                        ? readCadence(event.payload.cadence)
                        : state.cadence,
                endsOn:
                    event.payload.endsOn !== undefined
                        ? event.payload.endsOn
                        : state.endsOn,
            };
        case 'TemplateArchived':
            return state ? { ...state, isArchived: true } : state;
        case 'TemplateMaterialized':
            return state
                ? { ...state, lastMaterializedOn: event.payload.materializedOn }
                : state;
        default:
            return state;
    }
}
