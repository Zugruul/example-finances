import { MessageSquareIcon, PlugIcon, BellIcon } from 'lucide-react';
import type { ModuleManifest } from './types';

export const COMMUNICATION_MODULE_ID = 'communication';

/**
 * Communication module — outbound contact channels + reminders.
 * Provides a generic reminder scheduler that other modules can hook
 * into when both are installed. The Psychologist module, for
 * example, surfaces a "Send a reminder" toggle on its session form
 * when Communication is enabled on the same tenant.
 */
export const communicationModule: ModuleManifest = {
    id: COMMUNICATION_MODULE_ID,
    version: '1.0.0',
    name: 'Communication',
    description:
        'Send reminders by SMS, email, WhatsApp, Telegram, and WeChat.',
    icon: MessageSquareIcon,
    builtin: false,
    pages: [
        {
            id: 'reminders',
            label: 'Reminders',
            href: '/communication/reminders',
            icon: BellIcon,
            order: 1,
        },
        {
            id: 'integrations',
            label: 'Integrations',
            href: '/communication/integrations',
            icon: PlugIcon,
            order: 2,
        },
    ],
    uninstallPolicy: 'archive',
    ownedDomains: ['communication'],
};
