/**
 * Pure data + types for the admin seed wizard. Lives outside the
 * `'use server'` boundary in `admin-seed.ts` so the synchronous
 * `buildSeedPlan` planner can be imported into server components
 * (the wizard's Phase 1 inventory) without violating Next 16's
 * "Server Actions must be async functions" rule. The wizard's
 * actual server action (`seedTenantAction`) still lives in
 * `admin-seed.ts` and imports from here.
 */

export interface SeedAccount {
    name: string;
    type: 'checking' | 'savings' | 'credit_card';
    currency: 'USD';
    openingBalance: number; // minor units
}

export interface SeedCategory {
    name: string;
    type: 'income' | 'expense';
}

export interface SeedBudget {
    categoryName: string;
    monthlyAmount: number; // minor units
}

export interface SeedTemplate {
    description: string;
    cadence:
        | { kind: 'monthly'; dayOfMonth: number }
        | { kind: 'biweekly'; dayOfWeek: number };
    type: 'income' | 'expense';
    amount: number; // minor units
    accountName: string;
    categoryName: string;
}

export interface SeedPlan {
    version: string;
    items: Array<{ kind: string; count: number; note?: string }>;
    accounts: SeedAccount[];
    categories: SeedCategory[];
    budgets: SeedBudget[];
    templates: SeedTemplate[];
    transactionCount: number;
}

export const SEED_VERSION = 'v1';

export function buildSeedPlan(): SeedPlan {
    const accounts: SeedAccount[] = [
        { name: 'Checking', type: 'checking', currency: 'USD', openingBalance: 250_000 },
        { name: 'Savings', type: 'savings', currency: 'USD', openingBalance: 500_000 },
        { name: 'Credit card', type: 'credit_card', currency: 'USD', openingBalance: 0 },
    ];
    const categories: SeedCategory[] = [
        { name: 'Salary', type: 'income' },
        { name: 'Bonus', type: 'income' },
        { name: 'Groceries', type: 'expense' },
        { name: 'Rent', type: 'expense' },
        { name: 'Utilities', type: 'expense' },
        { name: 'Dining', type: 'expense' },
        { name: 'Transport', type: 'expense' },
        { name: 'Entertainment', type: 'expense' },
    ];
    const budgets: SeedBudget[] = [
        { categoryName: 'Groceries', monthlyAmount: 60_000 },
        { categoryName: 'Dining', monthlyAmount: 25_000 },
        { categoryName: 'Entertainment', monthlyAmount: 15_000 },
    ];
    const templates: SeedTemplate[] = [
        {
            description: 'Salary',
            cadence: { kind: 'monthly', dayOfMonth: 1 },
            type: 'income',
            amount: 500_000,
            accountName: 'Checking',
            categoryName: 'Salary',
        },
        {
            description: 'Rent',
            cadence: { kind: 'monthly', dayOfMonth: 5 },
            type: 'expense',
            amount: 150_000,
            accountName: 'Checking',
            categoryName: 'Rent',
        },
        {
            description: 'Streaming subscription',
            cadence: { kind: 'monthly', dayOfMonth: 15 },
            type: 'expense',
            amount: 1_500,
            accountName: 'Credit card',
            categoryName: 'Entertainment',
        },
    ];
    const transactionCount = 30;
    const items = [
        { kind: 'Accounts', count: accounts.length },
        { kind: 'Categories', count: categories.length },
        { kind: 'Budgets', count: budgets.length },
        { kind: 'Recurring templates', count: templates.length },
        {
            kind: 'Sample transactions',
            count: transactionCount,
            note: '~5/month for the last 6 months',
        },
    ];
    return {
        version: SEED_VERSION,
        items,
        accounts,
        categories,
        budgets,
        templates,
        transactionCount,
    };
}
