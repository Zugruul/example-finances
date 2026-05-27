import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { fetchAuditPage } from '@/lib/audit-query';
import { formatAuditEvent, type AuditCtx } from '@/lib/audit-format';
import { AuditStream } from './audit-stream';

export const dynamic = 'force-dynamic';

export default async function TenantAuditPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const memberships = await readModels.memberships.find({
        tenantId,
        userId: session.user.id,
    });
    const active = memberships.find((m) => !m.removedAt);
    if (!active) {
        throw new Error('Forbidden — you are not a member of this workspace.');
    }

    const [page, accounts, categories, allUsers, tenants] = await Promise.all([
        fetchAuditPage({ tenantId, limit: 50 }),
        readModels.accountsByTenant.find({ tenantId }),
        readModels.categoriesByTenant.find({ tenantId }),
        readModels.usersById.find({}),
        readModels.tenants.find({ tenantId }),
    ]);

    const tenant = tenants[0];

    const ctx: AuditCtx = {
        accounts: new Map(
            accounts.map((a) => [
                String(a.accountId),
                { displayName: a.name, currency: a.currency },
            ]),
        ),
        categories: new Map(
            categories.map((c) => [
                String(c.categoryId),
                { displayName: c.name },
            ]),
        ),
        users: new Map(
            allUsers
                .filter((u) => u.email)
                .map((u) => [String(u.userId), { email: u.email as string }]),
        ),
    };

    const initialCards = page.events.map((ev) => formatAuditEvent(ev, ctx));
    const accountOptions = accounts.map((a) => ({
        id: String(a.accountId),
        displayName: a.name,
    }));

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Workspaces', href: '/tenants' },
                    {
                        label: tenant?.displayName ?? 'Workspace',
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Audit' },
                ]}
            />
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Audit log
                </h1>
                <p className="text-sm text-muted-foreground">
                    Every action recorded in {tenant?.displayName ?? 'this workspace'}, newest first. Updates live.
                </p>
            </div>

            <AuditStream
                tenantId={tenantId}
                initialCards={initialCards}
                initialNextOlder={page.nextOlder}
                accountOptions={accountOptions}
                ctxSerialized={{
                    accounts: Array.from(ctx.accounts.entries()),
                    categories: Array.from(ctx.categories.entries()),
                    users: Array.from(ctx.users.entries()),
                }}
            />
        </main>
    );
}
