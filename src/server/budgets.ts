'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import {
    type BudgetStreamInstance,
    type RolloverPolicy,
} from '@/domains/budgets';
import type { MembershipRole } from '@/domains/tenants';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext, effectiveAttributedId } from '@/lib/actor-context';
import { parseAmountToMinor } from '@/lib/money';
import { revalidateTenantDashboards } from '@/lib/revalidate-dashboards';

const ROLLOVER: readonly RolloverPolicy[] = ['none', 'carry-forward', 'reset'];

async function requireSession() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');
    return session;
}

async function requireRole(
    tenantId: string,
    userId: string,
    allowed: readonly MembershipRole[],
) {
    const memberships = await readModels.memberships.find({ tenantId, userId });
    const active = memberships.find((m) => !m.removedAt);
    if (!active || !allowed.includes(active.role)) {
        throw new Error('Forbidden — insufficient role for this tenant.');
    }
    return active;
}

function budgetStream(budgetId: string): BudgetStreamInstance {
    return `budget-${budgetId}` as BudgetStreamInstance;
}

function parseRollover(raw: string): RolloverPolicy {
    if (!ROLLOVER.includes(raw as RolloverPolicy)) {
        throw new Error(`Invalid rollover policy "${raw}"`);
    }
    return raw as RolloverPolicy;
}

export const createBudgetAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const categoryId = String(formData.get('categoryId') ?? '').trim();
        if (!categoryId) throw new Error('Category is required.');
        const [category] = await readModels.categoriesByTenant.find({
            categoryId,
        });
        if (!category || String(category.tenantId) !== tenantId) {
            throw new Error('Category not found in this tenant.');
        }

        // One active budget per (tenantId, categoryId).
        const existing = await readModels.budgetsByTenant.find({
            categoryId: categoryId as SorcUUID,
        });
        if (existing.some((b) => !b.isArchived)) {
            throw new Error(
                'A budget for this category is already active; archive it first.',
            );
        }

        const currency = String(formData.get('currency') ?? '')
            .trim()
            .toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
            throw new Error('Currency must be a 3-letter ISO-4217 code.');
        }
        const amountRaw = String(formData.get('monthlyAmount') ?? '').trim();
        const monthlyAmount = parseAmountToMinor(amountRaw, currency);
        if (monthlyAmount === null) {
            throw new Error('Monthly amount must be a non-negative decimal.');
        }
        const rolloverPolicy = parseRollover(
            String(formData.get('rolloverPolicy') ?? 'none'),
        );

        const budgetId = uuidv7() as SorcUUID;
        const stream = budgetStream(budgetId);

        await aggregates.budget.execute(
            'createBudget',
            {
                budgetId,
                tenantId: tenantId as SorcUUID,
                categoryId: categoryId as SorcUUID,
                monthlyAmount,
                currency,
                rolloverPolicy,
                createdByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/budgets`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/budgets`,
                'success',
                'Budget created',
            ),
        );
    },
);

export const updateBudgetAction = withActorContext(
    async (tenantId: string, budgetId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const amountRaw = String(formData.get('monthlyAmount') ?? '').trim();
        const rolloverRaw = String(formData.get('rolloverPolicy') ?? '').trim();
        // We don't know the budget's currency without a read-model lookup,
        // but updating monthlyAmount requires it. Fetch the current doc.
        const [doc] = (
            await readModels.budgetsByTenant.find({})
        ).filter((b) => String(b.budgetId) === budgetId);
        if (!doc || String(doc.tenantId) !== tenantId) {
            throw new Error('Budget not found.');
        }
        const monthlyAmount =
            amountRaw === ''
                ? undefined
                : (parseAmountToMinor(amountRaw, doc.currency) ?? undefined);
        if (amountRaw && monthlyAmount === undefined) {
            throw new Error('Monthly amount must be a non-negative decimal.');
        }
        const rolloverPolicy =
            rolloverRaw === '' ? undefined : parseRollover(rolloverRaw);

        const stream = budgetStream(budgetId);
        await aggregates.budget.execute(
            'updateBudget',
            {
                monthlyAmount,
                rolloverPolicy,
                updatedByUserId: actorId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/budgets`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/budgets`,
                'success',
                'Budget updated',
            ),
        );
    },
);

export const archiveBudgetAction = withActorContext(
    async (tenantId: string, budgetId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        const actorId = effectiveAttributedId(session);
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const stream = budgetStream(budgetId);
        await aggregates.budget.execute(
            'archiveBudget',
            { archivedByUserId: actorId, stream } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/budgets`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/budgets`,
                'success',
                'Budget archived',
            ),
        );
    },
);
