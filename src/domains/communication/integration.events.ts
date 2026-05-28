import {
    SorcBaseEvent,
    SorcStreamInstance,
    SorcStreamPattern,
    SorcPayload,
    SorcUUID,
    domain,
    foreign,
    property,
} from '@event-sorcerer/core';

/**
 * Communication module — Integration entity.
 *
 * Stores credentials + config for an outbound messaging provider
 * (Twilio, Resend, WhatsApp Cloud, Telegram, WeChat, …). One row
 * per (tenant, provider) — a tenant can plug in multiple providers
 * to cover different channels.
 *
 * The `config` blob is a per-provider JSON object (apiKey,
 * accountSid, botToken, etc.) and is tagged `['pii']` so the
 * cryptoshredding plugin encrypts it before persist. Dropping the
 * tenant's per-tenant key invalidates every stored credential.
 *
 * Channels each provider covers (set on Integration so the reminder
 * scheduler can pick a provider per channel):
 *   twilio        → sms, mms, voice (future), rcs (future)
 *   resend        → email
 *   whatsapp      → whatsapp (Meta Cloud API)
 *   telegram      → telegram (bot)
 *   wechat        → wechat / weixin
 *
 * Disabling an integration is reversible (status flips). Removing
 * deletes the read-model row (event log keeps history).
 */

export type CommunicationIntegrationStreamInstance =
    SorcStreamInstance<`communication-integration-${string}`>;
export type CommunicationIntegrationStreamPattern =
    SorcStreamPattern<`communication-integration-${string}`>;

export type CommunicationProvider =
    | 'twilio'
    | 'resend'
    | 'whatsapp-cloud'
    | 'telegram'
    | 'wechat';

export type CommunicationChannel =
    | 'sms'
    | 'mms'
    | 'email'
    | 'voice'
    | 'rcs'
    | 'whatsapp'
    | 'telegram'
    | 'wechat';

@domain('communication')
export class CommunicationIntegrationConnectedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    integrationId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', required: true })
    provider!: CommunicationProvider;

    @property({ type: 'string', required: true, tags: ['pii'] })
    /** JSON-encoded per-provider config — apiKey, accountSid, botToken, etc. */
    config!: string;

    @property({ type: 'string', required: true })
    label!: string; // human-readable, e.g. "Main Twilio"

    @foreign('users')
    @property({ type: 'uuid', required: true })
    connectedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    connectedAt!: Date;
}

@domain('communication')
export class CommunicationIntegrationUpdatedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    integrationId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @property({ type: 'string', tags: ['pii'] })
    config?: string;

    @property({ type: 'string' })
    label?: string;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    updatedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    updatedAt!: Date;
}

@domain('communication')
export class CommunicationIntegrationDisabledPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    integrationId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('communication')
export class CommunicationIntegrationEnabledPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    integrationId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    changedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    changedAt!: Date;
}

@domain('communication')
export class CommunicationIntegrationRemovedPayload extends SorcPayload {
    @property({ type: 'uuid', required: true })
    integrationId!: SorcUUID;

    @foreign('tenants')
    @property({ type: 'uuid', required: true })
    tenantId!: SorcUUID;

    @foreign('users')
    @property({ type: 'uuid', required: true })
    removedByUserId!: SorcUUID;

    @property({ type: 'date', required: true })
    removedAt!: Date;
}

@domain('communication')
export class CommunicationIntegrationConnectedEvent extends SorcBaseEvent {
    readonly name = 'CommunicationIntegrationConnected' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationIntegrationStreamInstance,
        public payload: CommunicationIntegrationConnectedPayload,
    ) {
        super();
    }
}

@domain('communication')
export class CommunicationIntegrationUpdatedEvent extends SorcBaseEvent {
    readonly name = 'CommunicationIntegrationUpdated' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationIntegrationStreamInstance,
        public payload: CommunicationIntegrationUpdatedPayload,
    ) {
        super();
    }
}

@domain('communication')
export class CommunicationIntegrationDisabledEvent extends SorcBaseEvent {
    readonly name = 'CommunicationIntegrationDisabled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationIntegrationStreamInstance,
        public payload: CommunicationIntegrationDisabledPayload,
    ) {
        super();
    }
}

@domain('communication')
export class CommunicationIntegrationEnabledEvent extends SorcBaseEvent {
    readonly name = 'CommunicationIntegrationEnabled' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationIntegrationStreamInstance,
        public payload: CommunicationIntegrationEnabledPayload,
    ) {
        super();
    }
}

@domain('communication')
export class CommunicationIntegrationRemovedEvent extends SorcBaseEvent {
    readonly name = 'CommunicationIntegrationRemoved' as const;
    readonly version = '2026-05-28' as const;
    publishedAt: Date | null = null;
    revision: bigint | null = null;
    constructor(
        public stream: CommunicationIntegrationStreamInstance,
        public payload: CommunicationIntegrationRemovedPayload,
    ) {
        super();
    }
}

export const communicationIntegrationEvents = [
    CommunicationIntegrationConnectedEvent,
    CommunicationIntegrationUpdatedEvent,
    CommunicationIntegrationDisabledEvent,
    CommunicationIntegrationEnabledEvent,
    CommunicationIntegrationRemovedEvent,
] as const;

/** Channels each provider can drive. Used by Reminders to choose. */
export const PROVIDER_CHANNELS: Record<
    CommunicationProvider,
    readonly CommunicationChannel[]
> = {
    twilio: ['sms', 'mms', 'voice', 'rcs'],
    resend: ['email'],
    'whatsapp-cloud': ['whatsapp'],
    telegram: ['telegram'],
    wechat: ['wechat'],
};
