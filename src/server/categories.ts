'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '@/auth';
import { aggregates, readModels } from '@/sorc';
import {
    type CategoryStreamInstance,
    type CategoryType,
} from '@/domains/categories';
import type { MembershipRole } from '@/domains/tenants';
import type { SorcUUID } from '@event-sorcerer/core';
import { withToast } from '@/lib/toast-url';
import { withActorContext } from '@/lib/actor-context';
import { revalidateTenantDashboards } from '@/lib/revalidate-dashboards';

const CATEGORY_TYPES: readonly CategoryType[] = ['income', 'expense', 'transfer'];

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

function categoryStream(categoryId: string): CategoryStreamInstance {
    return `category-${categoryId}` as CategoryStreamInstance;
}

function parseCategoryType(raw: string): CategoryType {
    if (!CATEGORY_TYPES.includes(raw as CategoryType)) {
        throw new Error(`Invalid category type "${raw}"`);
    }
    return raw as CategoryType;
}

function parseColor(raw: string): string | undefined {
    const c = raw.trim();
    if (!c) return undefined;
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) {
        throw new Error(`Invalid color "${raw}" (expected #rrggbb)`);
    }
    return c.toLowerCase();
}

/**
 * Cycle-prevention: ascend the parent chain via the read model. If the
 * proposed parent already has the target category as an ancestor,
 * reparenting would form a cycle — reject.
 */
async function wouldCreateCycle(
    tenantId: string,
    categoryId: string,
    newParentId: string | undefined,
): Promise<boolean> {
    if (!newParentId) return false;
    if (newParentId === categoryId) return true;
    const visited = new Set<string>([categoryId]);
    let cursor: string | undefined = newParentId;
    while (cursor) {
        if (visited.has(cursor)) return true;
        visited.add(cursor);
        const [doc] = await readModels.categoriesByTenant.find({
            categoryId: cursor,
        });
        if (!doc || String(doc.tenantId) !== tenantId) return false;
        cursor = doc.parentId ? String(doc.parentId) : undefined;
    }
    return false;
}

export const createCategoryAction = withActorContext(
    async (tenantId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const name = String(formData.get('name') ?? '').trim();
        if (!name) throw new Error('Name is required.');
        const categoryType = parseCategoryType(
            String(formData.get('categoryType') ?? ''),
        );
        const parentRaw = String(formData.get('parentId') ?? '').trim();
        const parentId = parentRaw ? (parentRaw as SorcUUID) : undefined;
        const color = parseColor(String(formData.get('color') ?? ''));
        const icon =
            String(formData.get('icon') ?? '').trim() || undefined;

        if (parentId) {
            const [parent] = await readModels.categoriesByTenant.find({
                categoryId: parentId,
            });
            if (!parent || String(parent.tenantId) !== tenantId) {
                throw new Error('Parent category not found in this tenant.');
            }
        }

        const categoryId = uuidv7() as SorcUUID;
        const stream = categoryStream(categoryId);

        await aggregates.category.execute(
            'createCategory',
            {
                categoryId,
                tenantId: tenantId as SorcUUID,
                name,
                categoryType,
                parentId,
                color,
                icon,
                createdByUserId: userId,
                stream,
            } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/categories`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/categories`,
                'success',
                `Category "${name}" created`,
            ),
        );
    },
);

export const renameCategoryAction = withActorContext(
    async (tenantId: string, categoryId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const name = String(formData.get('name') ?? '').trim();
        if (!name) throw new Error('Name is required.');

        const stream = categoryStream(categoryId);
        await aggregates.category.execute(
            'renameCategory',
            { name, renamedByUserId: userId, stream } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/categories`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/categories`,
                'success',
                'Category renamed',
            ),
        );
    },
);

export const reparentCategoryAction = withActorContext(
    async (tenantId: string, categoryId: string, formData: FormData) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const parentRaw = String(formData.get('parentId') ?? '').trim();
        const parentId = parentRaw ? (parentRaw as SorcUUID) : undefined;

        if (await wouldCreateCycle(tenantId, categoryId, parentRaw || undefined)) {
            throw new Error(
                'Reparenting would create a cycle — the proposed parent is a descendant.',
            );
        }
        if (parentId) {
            const [parent] = await readModels.categoriesByTenant.find({
                categoryId: parentId,
            });
            if (!parent || String(parent.tenantId) !== tenantId) {
                throw new Error('Parent category not found in this tenant.');
            }
        }

        const stream = categoryStream(categoryId);
        await aggregates.category.execute(
            'reparentCategory',
            { parentId, reparentedByUserId: userId, stream } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/categories`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/categories`,
                'success',
                'Category moved',
            ),
        );
    },
);

export const archiveCategoryAction = withActorContext(
    async (tenantId: string, categoryId: string) => {
        const session = await requireSession();
        const userId = session.user!.id as SorcUUID;
        await requireRole(tenantId, userId, ['owner', 'admin']);

        const stream = categoryStream(categoryId);
        await aggregates.category.execute(
            'archiveCategory',
            { archivedByUserId: userId, stream } as never,
            { store: 'mongostore' as never, stream },
        );

        revalidatePath(`/tenants/${tenantId}/categories`);
        revalidateTenantDashboards(tenantId);
        redirect(
            withToast(
                `/tenants/${tenantId}/categories`,
                'success',
                'Category archived',
            ),
        );
    },
);
