import { notFound } from 'next/navigation';
import { readModels } from '@/sorc';

/**
 * Server-side route guard for module pages. Call from every Finances
 * (or future module) page's server component before rendering:
 *
 *     await requireModule(tenantId, 'finances');
 *
 * Behavior:
 *   - Module installed + enabled → return (page renders).
 *   - Module installed + disabled → `notFound()` (404).
 *   - Module not installed → `notFound()`.
 *
 * The check is read-model-only so it adds one indexed lookup
 * (`{aggregateKey: ${tenantId}|${moduleId}}`). Pair with the
 * tenant-membership gate already in the layout — this guard does NOT
 * verify membership.
 */
export async function requireModule(
    tenantId: string,
    moduleId: string,
): Promise<void> {
    const doc = await readModels.tenantModules.findOne({
        aggregateKey: `${tenantId}|${moduleId}`,
    });
    if (!doc || doc.status !== 'installed') notFound();
}

export async function isModuleInstalled(
    tenantId: string,
    moduleId: string,
): Promise<boolean> {
    const doc = await readModels.tenantModules.findOne({
        aggregateKey: `${tenantId}|${moduleId}`,
    });
    return !!doc && doc.status === 'installed';
}

/** Read-model list of installed modules for a tenant. */
export async function installedModulesFor(
    tenantId: string,
): Promise<
    Array<{
        moduleId: string;
        status: 'installed' | 'disabled';
        version: string;
    }>
> {
    const docs = await readModels.tenantModules.find({ tenantId });
    return docs.map((d) => ({
        moduleId: d.moduleId,
        status: d.status,
        version: d.version,
    }));
}
