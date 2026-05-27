import type { CommandContext, SorcUUID } from '@event-sorcerer/core';
import {
    TemplateCreatedEvent,
    TemplateUpdatedEvent,
    TemplateArchivedEvent,
    TemplateMaterializedEvent,
    type TemplateStreamInstance,
    type TemplateType,
    type Cadence,
} from './template.events';

export type TemplateState = null | {
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

export type TemplateEvent = InstanceType<
    | typeof TemplateCreatedEvent
    | typeof TemplateUpdatedEvent
    | typeof TemplateArchivedEvent
    | typeof TemplateMaterializedEvent
>;

/**
 * Tolerate both shapes during the Wave-F migration:
 *   - legacy events (pre-`type: 'object'`): cadence stored as JSON string
 *   - new events: cadence stored as a Cadence object
 *
 * Safe fallback for malformed/empty legacy strings: daily cadence (the
 * least-bad guess for a template that exists with broken data).
 */
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

export function templateReducer(
    state: TemplateState,
    event: TemplateEvent,
): TemplateState {
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

export type CreateTemplateCmd = {
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
    createdByUserId: SorcUUID;
    stream: TemplateStreamInstance;
};

export type UpdateTemplateCmd = {
    amount?: number;
    description?: string;
    cadence?: Cadence;
    endsOn?: string;
    updatedByUserId: SorcUUID;
    stream: TemplateStreamInstance;
};

export type ArchiveTemplateCmd = {
    archivedByUserId: SorcUUID;
    stream: TemplateStreamInstance;
};

export type MaterializeTemplateCmd = {
    materializedOn: string;
    transactionId: SorcUUID;
    stream: TemplateStreamInstance;
};

export const templateCommands = {
    createTemplate(
        state: TemplateState,
        cmd: CreateTemplateCmd,
        ctx?: CommandContext,
    ): void {
        if (state)
            throw new Error(`Template ${cmd.templateId} already exists`);
        if (cmd.amount <= 0) throw new Error('Amount must be positive.');
        ctx!.emit(
            TemplateCreatedEvent,
            {
                templateId: cmd.templateId,
                tenantId: cmd.tenantId,
                accountId: cmd.accountId,
                categoryId: cmd.categoryId,
                amount: cmd.amount,
                description: cmd.description,
                transactionType: cmd.transactionType,
                cadence: cmd.cadence,
                startsOn: cmd.startsOn,
                endsOn: cmd.endsOn,
                createdByUserId: cmd.createdByUserId,
                createdAt: new Date(),
            } as InstanceType<typeof TemplateCreatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    updateTemplate(
        state: TemplateState,
        cmd: UpdateTemplateCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Template does not exist');
        if (state.isArchived) throw new Error('Template is archived');
        if (cmd.amount !== undefined && cmd.amount <= 0) {
            throw new Error('Amount must be positive.');
        }
        ctx!.emit(
            TemplateUpdatedEvent,
            {
                templateId: state.templateId,
                amount: cmd.amount,
                description: cmd.description,
                cadence: cmd.cadence,
                endsOn: cmd.endsOn,
                updatedByUserId: cmd.updatedByUserId,
                updatedAt: new Date(),
            } as InstanceType<typeof TemplateUpdatedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    archiveTemplate(
        state: TemplateState,
        cmd: ArchiveTemplateCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Template does not exist');
        if (state.isArchived) throw new Error('Template already archived');
        ctx!.emit(
            TemplateArchivedEvent,
            {
                templateId: state.templateId,
                archivedByUserId: cmd.archivedByUserId,
                archivedAt: new Date(),
            } as InstanceType<typeof TemplateArchivedEvent>['payload'],
            { stream: cmd.stream },
        );
    },

    materializeTemplate(
        state: TemplateState,
        cmd: MaterializeTemplateCmd,
        ctx?: CommandContext,
    ): void {
        if (!state) throw new Error('Template does not exist');
        if (state.isArchived) throw new Error('Template is archived');
        // Idempotence: don't re-materialize the same date.
        if (
            state.lastMaterializedOn &&
            state.lastMaterializedOn >= cmd.materializedOn
        ) {
            throw new Error(
                `Template already materialized through ${state.lastMaterializedOn}`,
            );
        }
        ctx!.emit(
            TemplateMaterializedEvent,
            {
                templateId: state.templateId,
                materializedOn: cmd.materializedOn,
                transactionId: cmd.transactionId,
                materializedAt: new Date(),
            } as InstanceType<typeof TemplateMaterializedEvent>['payload'],
            { stream: cmd.stream },
        );
    },
};
