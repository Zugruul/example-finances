import {
    BarChart3Icon,
    CalendarIcon,
    HeartPulseIcon,
    LayoutDashboardIcon,
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
            id: 'overview',
            label: 'Overview',
            href: '/psychologist',
            icon: LayoutDashboardIcon,
            order: 1,
        },
        {
            id: 'clients',
            label: 'Clients',
            href: '/psychologist/clients',
            icon: UsersIcon,
            order: 2,
        },
        {
            id: 'sessions',
            label: 'Sessions',
            href: '/psychologist/sessions',
            icon: CalendarIcon,
            order: 3,
        },
        {
            id: 'notes',
            label: 'Notes',
            href: '/psychologist/notes',
            icon: NotebookPenIcon,
            order: 4,
        },
        {
            id: 'reports',
            label: 'Reports',
            href: '/psychologist/reports',
            icon: BarChart3Icon,
            order: 5,
        },
    ],
    uninstallPolicy: 'archive',
    ownedDomains: ['psychologist'],
};
