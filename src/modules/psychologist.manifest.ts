import { HeartPulseIcon, UsersIcon } from 'lucide-react';
import type { ModuleManifest } from './types';

export const PSYCHOLOGIST_MODULE_ID = 'psychologist';

/**
 * Psychologist module (Phase 1).
 *
 * Surface delivered in this cut: Clients (the EHR's identity layer).
 * Every PII field on the client aggregate (name, email, phone,
 * address, DOB, intake notes) is tagged for the cryptoshredding
 * plugin so dropping a tenant's per-tenant key renders every
 * persisted client event unreadable — GDPR / HIPAA "right to be
 * forgotten" without a full-table sweep.
 *
 * Future pages this manifest reserves but doesn't yet implement
 * (kept off the `pages` array until they land in code):
 *   - Sessions: per-appointment aggregate
 *   - Notes (EHR): clinical-notes domain, fully encrypted note body
 *   - Calendar: external-OAuth integration (Google / iCal)
 *   - Reminders: messaging-plugin-driven SMS/email
 *   - Telehealth: WebRTC pair-aggregate per session
 */
export const psychologistModule: ModuleManifest = {
    id: PSYCHOLOGIST_MODULE_ID,
    version: '1.0.0',
    name: 'Psychologist',
    description:
        'Manage clients with HIPAA-grade encryption. Phase 1 covers ' +
        'the client roster; sessions, notes, reminders, and ' +
        'telehealth are on the way.',
    icon: HeartPulseIcon,
    builtin: false,
    pages: [
        {
            id: 'clients',
            label: 'Clients',
            href: '/clients',
            icon: UsersIcon,
            order: 1,
        },
    ],
    uninstallPolicy: 'archive',
    ownedDomains: ['clients'],
};
