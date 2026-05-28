import {
    CalendarIcon,
    HeartPulseIcon,
    NotebookPenIcon,
    UsersIcon,
} from 'lucide-react';
import type { ModuleManifest } from './types';

export const PSYCHOLOGIST_MODULE_ID = 'psychologist';

/**
 * Psychologist module — clinical practice management.
 *
 * Every PII field on the clinical entities (client, session,
 * note) is cryptoshredded. Telehealth meetings link out to the
 * generic `telehealth` domain so future modules can reuse the
 * same meeting concept. Reminders for sessions flow through the
 * Communication module when that module is installed on the same
 * tenant.
 */
export const psychologistModule: ModuleManifest = {
    id: PSYCHOLOGIST_MODULE_ID,
    version: '1.0.0',
    name: 'Psychologist',
    description:
        'Manage clients with HIPAA-grade encryption.',
    icon: HeartPulseIcon,
    builtin: false,
    pages: [
        {
            id: 'clients',
            label: 'Clients',
            href: '/psychologist/clients',
            icon: UsersIcon,
            order: 1,
        },
        {
            id: 'sessions',
            label: 'Sessions',
            href: '/psychologist/sessions',
            icon: CalendarIcon,
            order: 2,
        },
        {
            id: 'notes',
            label: 'Notes',
            href: '/psychologist/notes',
            icon: NotebookPenIcon,
            order: 3,
        },
    ],
    uninstallPolicy: 'archive',
    ownedDomains: ['psychologist'],
};
