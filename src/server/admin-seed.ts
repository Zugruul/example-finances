'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import { withActorContext, effectiveAttributedId } from '@/lib/actor-context';
import { withToast } from '@/lib/toast-url';
import type { SorcUUID } from '@event-sorcerer/core';
import type { TransactionStreamInstance } from '@/domains/transactions';
import type { BudgetStreamInstance } from '@/domains/budgets';
import type { TemplateStreamInstance } from '@/domains/recurring-templates';

// Plan + types now live in `admin-seed-plan.ts` so the synchronous
// `buildSeedPlan` planner can be imported from server components.
// Next 16's `'use server'` rule prohibits non-async exports from this
// file, so we re-export types only and import the planner for our own
// use below.
import {
    buildSeedPlan,
    type SeedPlan,
} from '@/server/admin-seed-plan';
export type {
    SeedPlan,
    SeedAccount,
    SeedCategory,
    SeedBudget,
    SeedTemplate,
} from '@/server/admin-seed-plan';

/**
 * Actually run the seed. The wizard's Phase 3 form posts here with
 * `tenantId`, `confirm` (literal "seed"), and `impersonatingAck`
 * (literal "yes") when the admin is impersonating the target user.
 *
 * Safety rails:
 *   1. Admin-only (session.user.isAdmin).
 *   2. The action verifies the impersonation acknowledgement is
 *      present iff session.user.impersonation is set, and that the
 *      impersonation target lines up with the tenant's owner. Failures
 *      throw — they're not just bad UX, they're a security gate.
 *   3. The literal `confirm` value MUST equal the magic string
 *      "seed" — accidental form re-submits without the wizard's
 *      explicit checkbox don't fire.
 *
 * Mutations happen via the existing aggregates; the seed action is
 * basically a sequence of normal command executions. No new event
 * types are introduced.
 */
export const seedTenantAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await auth();
        if (!session?.user?.isAdmin) {
            throw new Error('Forbidden — admin only.');
        }
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        const confirm = String(formData.get('confirm') ?? '');
        if (confirm !== 'seed') {
            throw new Error(
                'Missing confirmation token — restart the seed wizard from Phase 1.',
            );
        }
        const impersonatingAck =
            String(formData.get('impersonatingAck') ?? '') === 'yes';
        const isImpersonating = !!session.user!.impersonation;
        if (isImpersonating && !impersonatingAck) {
            throw new Error(
                'Impersonation acknowledgement required — re-check the box on Phase 3.',
            );
        }
        // If admin is impersonating, the target of the impersonation
        // should also own the tenant — otherwise the seed would
        // generate transactions under an impersonation that has nothing
        // to do with the seeded tenant.
        const [tenant] = await readModels.tenants.find({ tenantId });
        if (!tenant) throw new Error('Tenant not found.');
        const memberships = await readModels.memberships.find({ tenantId });
        const owner = memberships.find(
            (m) => !m.removedAt && m.role === 'owner',
        );
        if (
            isImpersonating &&
            owner &&
            String(owner.userId) !== String(session.user!.impersonation!.targetUserId)
        ) {
            throw new Error(
                'Impersonation target does not own the selected tenant — refusing to seed.',
            );
        }

        const plan = buildSeedPlan();

        // --- 1. Accounts ---
        const accountIdByName = new Map<string, SorcUUID>();
        for (const a of plan.accounts) {
            const accountId = uuidv7() as SorcUUID;
            accountIdByName.set(a.name, accountId);
            const stream = `account-${accountId}` as never;
            await aggregates.account.execute(
                'createAccount',
                {
                    accountId,
                    tenantId: tenantId as SorcUUID,
                    name: a.name,
                    type: a.type,
                    currency: a.currency,
                    openingBalance: a.openingBalance,
                    createdByUserId: actorId,
                    stream,
                } as never,
                { store: 'mongostore' as never, stream },
            );
        }

        // --- 2. Categories ---
        const categoryIdByName = new Map<string, SorcUUID>();
        for (const c of plan.categories) {
            const categoryId = uuidv7() as SorcUUID;
            categoryIdByName.set(c.name, categoryId);
            const stream = `category-${categoryId}` as never;
            await aggregates.category.execute(
                'createCategory',
                {
                    categoryId,
                    tenantId: tenantId as SorcUUID,
                    name: c.name,
                    type: c.type,
                    createdByUserId: actorId,
                    stream,
                } as never,
                { store: 'mongostore' as never, stream },
            );
        }

        // --- 3. Budgets ---
        for (const b of plan.budgets) {
            const categoryId = categoryIdByName.get(b.categoryName);
            if (!categoryId) continue;
            const budgetId = uuidv7() as SorcUUID;
            const stream =
                `budget-${budgetId}` as BudgetStreamInstance;
            await aggregates.budget.execute(
                'createBudget',
                {
                    budgetId,
                    tenantId: tenantId as SorcUUID,
                    categoryId,
                    monthlyAmount: b.monthlyAmount,
                    currency: 'USD',
                    rolloverPolicy: 'none',
                    createdByUserId: actorId,
                    stream,
                } as never,
                { store: 'mongostore' as never, stream },
            );
        }

        // --- 4. Recurring templates ---
        for (const t of plan.templates) {
            const templateId = uuidv7() as SorcUUID;
            const accountId = accountIdByName.get(t.accountName);
            const categoryId = categoryIdByName.get(t.categoryName);
            if (!accountId) continue;
            const stream =
                `template-${templateId}` as TemplateStreamInstance;
            await aggregates.recurringTemplate.execute(
                'createTemplate',
                {
                    templateId,
                    tenantId: tenantId as SorcUUID,
                    accountId,
                    categoryId,
                    amount: t.amount,
                    description: t.description,
                    transactionType: t.type,
                    cadence: t.cadence,
                    startsOn: monthsAgoYmd(6),
                    createdByUserId: actorId,
                    stream,
                } as never,
                { store: 'mongostore' as never, stream },
            );
        }

        // --- 5. Sample transactions across the last 6 months ---
        // Pseudo-random but deterministic per-tenant so re-seeding the
        // same tenant produces identical data. Avoids "shuffled twice"
        // confusion when debugging.
        const rng = mulberry32(hashTenantId(tenantId));
        const expenseCategories = plan.categories.filter(
            (c) => c.type === 'expense',
        );
        const incomeCategories = plan.categories.filter(
            (c) => c.type === 'income',
        );
        for (let i = 0; i < plan.transactionCount; i++) {
            const isIncome = rng() < 0.25;
            const cat = isIncome
                ? incomeCategories[Math.floor(rng() * incomeCategories.length)]!
                : expenseCategories[
                      Math.floor(rng() * expenseCategories.length)
                  ]!;
            const account = plan.accounts[Math.floor(rng() * 2)]!;
            const accountId = accountIdByName.get(account.name)!;
            const categoryId = categoryIdByName.get(cat.name);
            const monthOffset = Math.floor(rng() * 6);
            const day = 1 + Math.floor(rng() * 27);
            const occurredOn = monthOffsetYmd(monthOffset, day);
            const amount = isIncome
                ? 50_000 + Math.floor(rng() * 200_000)
                : 500 + Math.floor(rng() * 20_000);
            const transactionId = uuidv7() as SorcUUID;
            const stream =
                `transaction-${transactionId}` as TransactionStreamInstance;
            await aggregates.transaction.execute(
                'recordTransaction',
                {
                    transactionId,
                    tenantId: tenantId as SorcUUID,
                    accountId,
                    categoryId,
                    amount,
                    currency: 'USD',
                    occurredOn,
                    description: `Seeded ${cat.name.toLowerCase()}`,
                    transactionType: isIncome ? 'income' : 'expense',
                    recordedByUserId: actorId,
                    stream,
                } as never,
                { store: 'mongostore' as never, stream },
            );
        }

        revalidatePath(`/tenants/${tenantId}`);
        revalidatePath(`/tenants/${tenantId}/dashboard`);
        revalidatePath('/dashboard');
        revalidatePath('/admin');
        redirect(
            withToast(
                `/tenants/${tenantId}/dashboard`,
                'success',
                'Tenant seeded',
            ),
        );
    },
);

function monthsAgoYmd(months: number): string {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - months);
    return d.toISOString().slice(0, 10);
}

function monthOffsetYmd(monthsAgo: number, day: number): string {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - monthsAgo);
    const last = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.toISOString().slice(0, 10);
}

function hashTenantId(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** Tiny seeded PRNG (mulberry32) so seeded data is deterministic per tenant. */
function mulberry32(a: number) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
