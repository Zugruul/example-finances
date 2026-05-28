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

        // --- 5. Deterministic transactions across the past N months.
        // No randomness — every (date, amount, description) is a pure
        // function of the calendar window. Two runs with the same
        // current date produce identical events (modulo new uuids on
        // the events themselves). This makes seeded tenants directly
        // comparable across snapshots / runs.
        const monthsBack = plan.monthsBack;
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const windowStart = new Date(today);
        windowStart.setUTCMonth(windowStart.getUTCMonth() - monthsBack);

        const recordTx = async (params: {
            occurredOn: string;
            accountName: string;
            categoryName: string;
            amount: number;
            description: string;
            type: 'income' | 'expense';
            revertsTransactionIds?: SorcUUID[];
        }): Promise<SorcUUID> => {
            const accountId = accountIdByName.get(params.accountName);
            const categoryId = categoryIdByName.get(params.categoryName);
            if (!accountId) throw new Error(`No account ${params.accountName}`);
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
                    amount: params.amount,
                    currency: 'USD',
                    occurredOn: params.occurredOn,
                    description: params.description,
                    transactionType: params.type,
                    recordedByUserId: actorId,
                    revertsTransactionIds: params.revertsTransactionIds,
                    stream,
                } as never,
                { store: 'mongostore' as never, stream },
            );
            return transactionId;
        };

        // --- 5a. Materialize each recurring template across the
        // window. Bi-weekly paychecks + monthly bills + streaming
        // subscriptions all land as concrete TransactionRecorded
        // events so the heatmap + charts populate immediately.
        for (const t of plan.templates) {
            const dates = cadenceDates(t.cadence, windowStart, today);
            for (const d of dates) {
                await recordTx({
                    occurredOn: d,
                    accountName: t.accountName,
                    categoryName: t.categoryName,
                    amount: t.amount,
                    description: t.description,
                    type: t.type,
                });
            }
        }

        // --- 5b. Deterministic everyday spending. Each rule fires on
        // a specific weekday with a fixed amount and description; the
        // cycle index (which week in the window) chooses from a
        // round-robin variant list so the descriptions feel alive
        // without using a PRNG.
        //
        // Day-of-week numbering: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu,
        // 5=Fri, 6=Sat.
        type DowRule = {
            dow: number;
            category: string;
            account: 'Checking' | 'Credit card';
            amounts: number[]; // minor units; cycles per occurrence
            descriptions: string[]; // cycles per occurrence
        };
        const dowRules: DowRule[] = [
            // Big weekly grocery run on Sunday
            {
                dow: 0,
                category: 'Groceries',
                account: 'Checking',
                amounts: [8_540, 9_215, 7_320, 10_180, 6_995, 8_410],
                descriptions: [
                    'Whole Foods',
                    'Trader Joes',
                    'Safeway',
                    'Costco run',
                    'Sprouts',
                    'Whole Foods',
                ],
            },
            // Midweek grocery top-up on Wednesday
            {
                dow: 3,
                category: 'Groceries',
                account: 'Checking',
                amounts: [3_420, 2_815, 4_005, 3_280, 2_975, 3_640],
                descriptions: [
                    'Corner deli',
                    'Trader Joes',
                    'Local market',
                    'Corner deli',
                    'Trader Joes',
                    'Corner deli',
                ],
            },
            // Weekday coffee — Mon, Tue, Thu (so ~3 per week)
            {
                dow: 1,
                category: 'Coffee',
                account: 'Credit card',
                amounts: [575, 625, 545, 595, 525, 615],
                descriptions: [
                    'Starbucks',
                    'Blue Bottle',
                    'Philz',
                    'Local cafe',
                    'Peets',
                    'Starbucks',
                ],
            },
            {
                dow: 2,
                category: 'Coffee',
                account: 'Credit card',
                amounts: [495, 525, 585, 515, 565, 545],
                descriptions: [
                    'Local cafe',
                    'Philz',
                    'Blue Bottle',
                    'Starbucks',
                    'Peets',
                    'Local cafe',
                ],
            },
            {
                dow: 4,
                category: 'Coffee',
                account: 'Credit card',
                amounts: [635, 585, 555, 605, 525, 595],
                descriptions: [
                    'Blue Bottle',
                    'Peets',
                    'Starbucks',
                    'Local cafe',
                    'Philz',
                    'Blue Bottle',
                ],
            },
            // Friday dinner out
            {
                dow: 5,
                category: 'Dining',
                account: 'Credit card',
                amounts: [4_280, 3_795, 5_120, 3_450, 4_625, 4_180],
                descriptions: [
                    'Sushi night',
                    'Pizza',
                    'Thai takeout',
                    'Burger spot',
                    'Pasta',
                    'Ramen',
                ],
            },
            // Saturday brunch / dinner
            {
                dow: 6,
                category: 'Dining',
                account: 'Credit card',
                amounts: [3_540, 4_920, 3_115, 5_440, 3_780, 4_320],
                descriptions: [
                    'Brunch',
                    'Mexican grill',
                    'Brunch',
                    'Steakhouse',
                    'Brunch',
                    'Mexican grill',
                ],
            },
        ];

        // Walk every day in the window once. For each DoW rule whose
        // day-of-week matches, fire it with a per-occurrence cycle
        // index so amounts + descriptions rotate deterministically.
        const occurrenceByRule = new Map<number, number>();
        for (
            let d = new Date(windowStart);
            d <= today;
            d.setUTCDate(d.getUTCDate() + 1)
        ) {
            const ymd = d.toISOString().slice(0, 10);
            const dow = d.getUTCDay();
            for (let ri = 0; ri < dowRules.length; ri++) {
                const rule = dowRules[ri]!;
                if (rule.dow !== dow) continue;
                const k = ri;
                const idx = occurrenceByRule.get(k) ?? 0;
                const amount = rule.amounts[idx % rule.amounts.length]!;
                const description =
                    rule.descriptions[idx % rule.descriptions.length]!;
                await recordTx({
                    occurredOn: ymd,
                    accountName: rule.account,
                    categoryName: rule.category,
                    amount,
                    description,
                    type: 'expense',
                });
                occurrenceByRule.set(k, idx + 1);
            }
        }

        // --- 5c. Per-month one-offs anchored to specific days. Fixed
        // amounts and descriptions; one row per month so the picture
        // includes the predictable monthly expenses too.
        type MonthlyOneOff = {
            day: number;
            category: string;
            account: 'Checking' | 'Credit card';
            amounts: number[]; // cycles per month from oldest→newest
            descriptions: string[];
        };
        const monthlyOneOffs: MonthlyOneOff[] = [
            // 2 gas fill-ups per month (mid and end)
            {
                day: 9,
                category: 'Gas',
                account: 'Credit card',
                amounts: [4_870, 5_215, 4_640, 5_510, 5_080, 4_920],
                descriptions: ['Shell', 'Chevron', '76', 'Costco gas', 'Shell', 'Chevron'],
            },
            {
                day: 24,
                category: 'Gas',
                account: 'Credit card',
                amounts: [5_120, 4_680, 5_385, 4_770, 5_245, 4_905],
                descriptions: ['76', 'Costco gas', 'Shell', 'Chevron', 'Costco gas', '76'],
            },
            // Utilities
            {
                day: 20,
                category: 'Utilities',
                account: 'Checking',
                amounts: [9_245, 7_815, 8_640, 11_320, 10_215, 8_540],
                descriptions: [
                    'PG&E (electric + gas)',
                    'PG&E (electric + gas)',
                    'PG&E (electric + gas)',
                    'PG&E (electric + gas)',
                    'PG&E (electric + gas)',
                    'PG&E (electric + gas)',
                ],
            },
            // Transport (Uber + transit)
            {
                day: 6,
                category: 'Transport',
                account: 'Credit card',
                amounts: [1_840, 2_240, 1_575, 2_650, 1_920, 2_115],
                descriptions: ['Uber', 'Lyft', 'BART', 'Uber', 'Lyft', 'Caltrain'],
            },
            {
                day: 27,
                category: 'Transport',
                account: 'Credit card',
                amounts: [1_240, 1_815, 2_080, 1_465, 2_350, 1_695],
                descriptions: ['Lyft', 'Uber', 'Caltrain', 'BART', 'Uber', 'Lyft'],
            },
            // Monthly entertainment (1 night out)
            {
                day: 17,
                category: 'Entertainment',
                account: 'Credit card',
                amounts: [3_240, 4_820, 2_815, 6_120, 3_450, 4_640],
                descriptions: [
                    'Movie tickets',
                    'Concert',
                    'Bowling',
                    'Concert',
                    'Mini golf',
                    'Movie tickets',
                ],
            },
            // Pharmacy / health (most months)
            {
                day: 11,
                category: 'Health',
                account: 'Credit card',
                amounts: [1_585, 2_240, 1_320, 3_410, 1_870, 2_115],
                descriptions: ['CVS', 'Walgreens', 'Pharmacy', 'Co-pay', 'CVS', 'Walgreens'],
            },
            // Haircut every other month
            {
                day: 13,
                category: 'Personal care',
                account: 'Credit card',
                amounts: [3_500, 0, 3_500, 0, 3_500, 0],
                descriptions: ['Barber', '', 'Haircut', '', 'Barber', ''],
            },
            // Home goods (most months)
            {
                day: 23,
                category: 'Home goods',
                account: 'Credit card',
                amounts: [4_220, 0, 6_815, 2_545, 0, 5_120],
                descriptions: ['Target', '', 'IKEA', 'Target', '', 'Bed Bath & Beyond'],
            },
            // Clothing — only every couple months
            {
                day: 8,
                category: 'Clothing',
                account: 'Credit card',
                amounts: [0, 12_440, 0, 8_215, 0, 14_980],
                descriptions: ['', 'Uniqlo', '', 'Nike', '', 'Zara'],
            },
            // Freelance bonus — once in the window
            {
                day: 19,
                category: 'Freelance',
                account: 'Checking',
                amounts: [0, 75_000, 0, 0, 0, 0],
                descriptions: ['', 'Freelance project', '', '', '', ''],
            },
        ];

        // Months in oldest→newest order — index 0 maps to the oldest
        // month in the window, index `monthsBack-1` is the current
        // (partial) month. Amounts/descriptions cycle in that order so
        // a re-seed always produces the same rows for the same window.
        const recordedExpenses: Array<{
            id: SorcUUID;
            ymd: string;
            categoryName: string;
            amount: number;
            description: string;
        }> = [];
        for (let m = 0; m < monthsBack; m++) {
            const monthOffset = monthsBack - 1 - m; // oldest first
            for (const rule of monthlyOneOffs) {
                const amount = rule.amounts[m] ?? 0;
                if (amount === 0) continue;
                const description = rule.descriptions[m] ?? '';
                const occurredOn = monthOffsetYmd(monthOffset, rule.day);
                // Skip future-dated rows for the current month.
                if (occurredOn > today.toISOString().slice(0, 10)) continue;
                const isIncome = rule.category === 'Freelance';
                const id = await recordTx({
                    occurredOn,
                    accountName: rule.account,
                    categoryName: rule.category,
                    amount,
                    description,
                    type: isIncome ? 'income' : 'expense',
                });
                if (!isIncome) {
                    recordedExpenses.push({
                        id,
                        ymd: occurredOn,
                        categoryName: rule.category,
                        amount,
                        description,
                    });
                }
            }
        }

        // --- 5d. Three "wrong-day correction" revert pairs spread
        // across the window. Anchored at specific (monthOffset, day)
        // so the seed reproduces the same corrections every run.
        const revertAnchors: Array<{
            monthOffset: number;
            day: number;
        }> = [
            { monthOffset: 5, day: 17 }, // oldest-month entertainment
            { monthOffset: 3, day: 23 }, // home goods
            { monthOffset: 1, day: 17 }, // recent entertainment
        ];
        for (const anchor of revertAnchors) {
            const targetYmd = monthOffsetYmd(anchor.monthOffset, anchor.day);
            const target = recordedExpenses.find((e) => e.ymd === targetYmd);
            if (!target) continue;
            await recordTx({
                occurredOn: nudgeDate(target.ymd, 1),
                accountName: 'Credit card',
                categoryName: target.categoryName,
                amount: target.amount,
                description: `Revert (wrong day): ${target.description}`,
                type: 'income',
                revertsTransactionIds: [target.id],
            });
            await recordTx({
                occurredOn: nudgeDate(target.ymd, -2),
                accountName: 'Credit card',
                categoryName: target.categoryName,
                amount: target.amount,
                description: `Corrected: ${target.description}`,
                type: 'expense',
            });
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

/**
 * Walk a cadence rule forward across the window and return every
 * occurrence in YYYY-MM-DD form. Used to materialize recurring
 * templates into concrete TransactionRecorded events at seed time
 * so the bi-weekly paychecks + monthly bills show up in the
 * heatmap + dashboard immediately.
 */
function cadenceDates(
    cadence:
        | { kind: 'monthly'; dayOfMonth: number }
        | { kind: 'biweekly'; dayOfWeek: number },
    windowStart: Date,
    windowEnd: Date,
): string[] {
    const out: string[] = [];
    if (cadence.kind === 'monthly') {
        const cur = new Date(windowStart);
        cur.setUTCDate(1);
        while (cur <= windowEnd) {
            const last = new Date(
                Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0),
            ).getUTCDate();
            const day = Math.min(cadence.dayOfMonth, last);
            const occ = new Date(
                Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), day),
            );
            if (occ >= windowStart && occ <= windowEnd) {
                out.push(occ.toISOString().slice(0, 10));
            }
            cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
    } else {
        // biweekly: anchor on the first matching DoW in the window,
        // then step by 14 days.
        const start = new Date(windowStart);
        const dow = start.getUTCDay();
        const shift = (cadence.dayOfWeek - dow + 7) % 7;
        start.setUTCDate(start.getUTCDate() + shift);
        for (
            let d = new Date(start);
            d <= windowEnd;
            d.setUTCDate(d.getUTCDate() + 14)
        ) {
            out.push(d.toISOString().slice(0, 10));
        }
    }
    return out;
}

/** Add (or subtract) `days` from a YYYY-MM-DD; returns YYYY-MM-DD. */
function nudgeDate(ymd: string, days: number): string {
    const d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
