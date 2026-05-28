import {
    CalendarClockIcon,
    FolderTreeIcon,
    LayoutDashboardIcon,
    ListTreeIcon,
    PiggyBankIcon,
    WalletIcon,
} from 'lucide-react';
import type { ModuleManifest } from './types';

export const FINANCES_MODULE_ID = 'finances';

export const financesModule: ModuleManifest = {
    id: FINANCES_MODULE_ID,
    version: '1.0.0',
    name: 'Finances',
    description:
        'Track accounts, transactions, budgets, and recurring expenses.',
    icon: PiggyBankIcon,
    builtin: false,
    pages: [
        {
            id: 'dashboard',
            label: 'Dashboard',
            href: '/dashboard',
            icon: LayoutDashboardIcon,
            order: 1,
        },
        {
            id: 'accounts',
            label: 'Accounts',
            href: '/accounts',
            icon: WalletIcon,
            order: 2,
        },
        {
            id: 'transactions',
            label: 'Transactions',
            href: '/transactions',
            icon: ListTreeIcon,
            order: 3,
        },
        {
            id: 'categories',
            label: 'Categories',
            href: '/categories',
            icon: FolderTreeIcon,
            order: 4,
        },
        {
            id: 'budgets',
            label: 'Budgets',
            href: '/budgets',
            icon: PiggyBankIcon,
            order: 5,
        },
        {
            id: 'recurring',
            label: 'Recurring',
            href: '/recurring',
            icon: CalendarClockIcon,
            order: 6,
        },
    ],
    uninstallPolicy: 'archive',
    ownedDomains: [
        'accounts',
        'transactions',
        'categories',
        'budgets',
        'recurring-templates',
        'monthly-aggregates',
    ],
};
