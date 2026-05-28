import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/submit-button';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import {
    installModuleAction,
    enableModuleAction,
    disableModuleAction,
    uninstallModuleAction,
} from '@/server/modules';
import { listModules } from '@/modules/registry';

export const dynamic = 'force-dynamic';

/**
 * Module catalog. One card per known module with the user's tenants
 * listed beneath, showing install state + per-tenant toggles. Owner
 * / admin on a tenant can install / enable / disable / uninstall.
 *
 * The page is intentionally simple — Phase 2 of the Modules wave
 * will polish it with per-tenant filtering, last-changed metadata,
 * and an Install-on-multiple-tenants UI. For Phase 1 the goal is to
 * make the data model visible + manageable.
 */
export default async function ModulesPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const memberships = (
        await readModels.memberships.find({ userId: session.user.id })
    ).filter((m) => !m.removedAt);

    const tenantIds = memberships.map((m) => String(m.tenantId));
    const tenants = (
        await Promise.all(
            tenantIds.map((tid) => readModels.tenants.find({ tenantId: tid })),
        )
    )
        .flat()
        .filter((t) => !t.archivedAt);

    // (tenantId, moduleId) → install doc (or null).
    const installByKey = new Map<string, { status: 'installed' | 'disabled' }>();
    const allInstalls = await Promise.all(
        tenantIds.map((tid) => readModels.tenantModules.find({ tenantId: tid })),
    );
    for (const list of allInstalls) {
        for (const d of list) {
            installByKey.set(
                `${String(d.tenantId)}|${d.moduleId}`,
                { status: d.status },
            );
        }
    }

    // Owner / admin tenants — only these allow install/uninstall.
    const manageableTenantIds = new Set(
        memberships
            .filter((m) => m.role === 'owner' || m.role === 'admin')
            .map((m) => String(m.tenantId)),
    );

    const modules = listModules();

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar items={[{ label: 'Modules' }]} />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Modules
                </h1>
                <p className="text-sm text-muted-foreground">
                    Modules add pages + domain logic to a tenant. By default
                    a fresh tenant has no modules installed.
                </p>
            </header>

            {tenants.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No tenants yet. Create one to install modules.
                </p>
            ) : null}

            <div className="flex flex-col gap-4">
                {modules.map((m) => {
                    const Icon = m.icon;
                    return (
                        <Card key={m.id}>
                            <CardHeader className="flex flex-row items-center gap-3">
                                <Icon className="size-6 text-primary" />
                                <div className="flex flex-1 flex-col">
                                    <CardTitle className="text-base">
                                        {m.name}
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        {m.description}
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                    v{m.version}
                                </Badge>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {tenants.length === 0 ? null : (
                                    <ul className="flex flex-col gap-2">
                                        {tenants.map((t) => {
                                            const tenantId = String(t.tenantId);
                                            const install = installByKey.get(
                                                `${tenantId}|${m.id}`,
                                            );
                                            const canManage =
                                                manageableTenantIds.has(tenantId);
                                            return (
                                                <li
                                                    key={tenantId}
                                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                                                >
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-medium">
                                                            {t.displayName}
                                                        </span>
                                                        {install ? (
                                                            <Badge
                                                                variant="outline"
                                                                className={
                                                                    install.status ===
                                                                    'installed'
                                                                        ? 'border-emerald-500/60 text-emerald-700 dark:text-emerald-300'
                                                                        : 'border-amber-500/60 text-amber-700 dark:text-amber-300'
                                                                }
                                                            >
                                                                {install.status ===
                                                                'installed'
                                                                    ? 'enabled'
                                                                    : 'disabled'}
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-muted-foreground"
                                                            >
                                                                not installed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {!install &&
                                                        canManage ? (
                                                            <form
                                                                action={installModuleAction.bind(
                                                                    null,
                                                                    tenantId,
                                                                )}
                                                            >
                                                                <input
                                                                    type="hidden"
                                                                    name="moduleId"
                                                                    value={m.id}
                                                                />
                                                                <SubmitButton
                                                                    size="sm"
                                                                    pendingLabel="Installing…"
                                                                >
                                                                    Install
                                                                </SubmitButton>
                                                            </form>
                                                        ) : null}
                                                        {install?.status ===
                                                            'installed' &&
                                                        canManage ? (
                                                            <form
                                                                action={disableModuleAction.bind(
                                                                    null,
                                                                    tenantId,
                                                                )}
                                                            >
                                                                <input
                                                                    type="hidden"
                                                                    name="moduleId"
                                                                    value={m.id}
                                                                />
                                                                <SubmitButton
                                                                    size="sm"
                                                                    variant="outline"
                                                                    pendingLabel="Disabling…"
                                                                >
                                                                    Disable
                                                                </SubmitButton>
                                                            </form>
                                                        ) : null}
                                                        {install?.status ===
                                                            'disabled' &&
                                                        canManage ? (
                                                            <form
                                                                action={enableModuleAction.bind(
                                                                    null,
                                                                    tenantId,
                                                                )}
                                                            >
                                                                <input
                                                                    type="hidden"
                                                                    name="moduleId"
                                                                    value={m.id}
                                                                />
                                                                <SubmitButton
                                                                    size="sm"
                                                                    pendingLabel="Enabling…"
                                                                >
                                                                    Enable
                                                                </SubmitButton>
                                                            </form>
                                                        ) : null}
                                                        {install &&
                                                        canManage &&
                                                        m.uninstallPolicy !==
                                                            'forbid' ? (
                                                            <form
                                                                action={uninstallModuleAction.bind(
                                                                    null,
                                                                    tenantId,
                                                                )}
                                                            >
                                                                <input
                                                                    type="hidden"
                                                                    name="moduleId"
                                                                    value={m.id}
                                                                />
                                                                <SubmitButton
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    pendingLabel="Uninstalling…"
                                                                >
                                                                    Uninstall
                                                                </SubmitButton>
                                                            </form>
                                                        ) : null}
                                                        {!canManage ? (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                disabled
                                                            >
                                                                read-only
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </main>
    );
}
