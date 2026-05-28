'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';

/**
 * Provider-aware connect form. Each provider has its own set of
 * structured fields; the form picks which fields to render based on
 * the selected provider, assembles them into the `config` JSON blob
 * on submit, and hands FormData to the server action unchanged.
 *
 * The server action still receives a single `config` string — the
 * shape is identical to the previous "Config (JSON)" textarea. So
 * the encryption story + read-model contract don't change; only the
 * data entry experience does.
 */

type FieldSpec = {
    key: string;
    label: string;
    type: 'text' | 'password' | 'email' | 'tel';
    placeholder?: string;
    required?: boolean;
};

type ProviderId =
    | 'twilio'
    | 'resend'
    | 'whatsapp-cloud'
    | 'telegram'
    | 'wechat';

const PROVIDER_FIELDS: Record<
    ProviderId,
    { label: string; fields: FieldSpec[] }
> = {
    twilio: {
        label: 'Twilio (SMS / MMS / Voice / RCS)',
        fields: [
            {
                key: 'accountSid',
                label: 'Account SID',
                type: 'text',
                placeholder: 'AC...',
                required: true,
            },
            {
                key: 'authToken',
                label: 'Auth token',
                type: 'password',
                required: true,
            },
            {
                key: 'fromPhoneNumber',
                label: 'From phone number',
                type: 'tel',
                placeholder: '+1...',
                required: true,
            },
        ],
    },
    resend: {
        label: 'Resend (Email)',
        fields: [
            {
                key: 'apiKey',
                label: 'API key',
                type: 'password',
                placeholder: 're_...',
                required: true,
            },
            {
                key: 'fromEmail',
                label: 'From email',
                type: 'email',
                placeholder: 'no-reply@yourdomain.com',
                required: true,
            },
        ],
    },
    'whatsapp-cloud': {
        label: 'WhatsApp Cloud',
        fields: [
            {
                key: 'accessToken',
                label: 'Access token',
                type: 'password',
                placeholder: 'EAA...',
                required: true,
            },
            {
                key: 'phoneNumberId',
                label: 'Phone number id',
                type: 'text',
                required: true,
            },
            {
                key: 'verifyToken',
                label: 'Webhook verify token',
                type: 'password',
                required: true,
            },
        ],
    },
    telegram: {
        label: 'Telegram Bot',
        fields: [
            {
                key: 'botToken',
                label: 'Bot token',
                type: 'password',
                placeholder: '123:ABC...',
                required: true,
            },
        ],
    },
    wechat: {
        label: 'WeChat / Weixin',
        fields: [
            {
                key: 'appId',
                label: 'App ID',
                type: 'text',
                placeholder: 'wx...',
                required: true,
            },
            {
                key: 'appSecret',
                label: 'App secret',
                type: 'password',
                required: true,
            },
        ],
    },
};

export function IntegrationConnectForm({
    action,
}: {
    action: (formData: FormData) => Promise<void> | void;
}) {
    const [provider, setProvider] = useState<ProviderId>('twilio');
    const spec = PROVIDER_FIELDS[provider];

    async function wrapped(formData: FormData) {
        // Pull the structured fields and assemble the per-provider
        // config JSON. The form's per-provider inputs use names like
        // `field-<key>` so we don't collide with `label` etc; we
        // strip the prefix when reading.
        const config: Record<string, string> = {};
        for (const f of spec.fields) {
            const v = String(formData.get(`field-${f.key}`) ?? '').trim();
            if (v) config[f.key] = v;
        }
        // Strip the structured field names so they don't get forwarded
        // to the server (only the provider, label, and assembled
        // config matter).
        for (const f of spec.fields) {
            formData.delete(`field-${f.key}`);
        }
        formData.set('config', JSON.stringify(config));
        await action(formData);
    }

    return (
        <form action={wrapped} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="provider">Provider</Label>
                <select
                    id="provider"
                    name="provider"
                    required
                    value={provider}
                    onChange={(e) =>
                        setProvider(e.target.value as ProviderId)
                    }
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    {(Object.keys(PROVIDER_FIELDS) as ProviderId[]).map(
                        (id) => (
                            <option key={id} value={id}>
                                {PROVIDER_FIELDS[id].label}
                            </option>
                        ),
                    )}
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="label">Label</Label>
                <Input
                    id="label"
                    name="label"
                    required
                    placeholder={`Main ${provider}`}
                />
            </div>
            {spec.fields.map((f) => (
                <div
                    key={`${provider}-${f.key}`}
                    className={
                        f.type === 'password' ||
                        spec.fields.length === 1 ||
                        spec.fields.length % 2 === 1
                            ? 'flex flex-col gap-1.5 sm:col-span-2'
                            : 'flex flex-col gap-1.5'
                    }
                >
                    <Label htmlFor={`field-${f.key}`}>{f.label}</Label>
                    <Input
                        id={`field-${f.key}`}
                        name={`field-${f.key}`}
                        type={f.type}
                        placeholder={f.placeholder}
                        required={f.required}
                        autoComplete="off"
                    />
                </div>
            ))}
            <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Connecting…">Connect</SubmitButton>
            </div>
        </form>
    );
}
