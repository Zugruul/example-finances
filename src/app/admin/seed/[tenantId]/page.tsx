import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { seedTenantAction } from '@/server/admin-seed';
import { buildSeedPlan } from '@/server/admin-seed-plan';
import { SeedWizard } from './seed-wizard';

/**
 * Multi-phase seed admin tool.
 *
 * Stage is driven via `?step=1|2|3` on the URL so phase navigation
 * survives reloads + breadcrumb back/forward. The server resolves
 * everything the wizard needs (tenant + owner + members + current
 * impersonation state) and the SeedWizard client component handles
 * the per-phase rendering.
 */
type Params = { tenantId: string };
type SearchParams = { step?: string };

export default async function SeedTenantPage(props: {
    params: Promise<Params>;
    searchParams?: Promise<SearchParams>;
}) {
    const { tenantId } = await props.params;
    const sp = ((await props.searchParams) ?? {}) as SearchParams;
    const step = parseStep(sp.step);

    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');
    if (!session.user.isAdmin) {
        throw new Error('Forbidden — admin only.');
    }

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const memberships = await readModels.memberships.find({ tenantId });
    const owner = memberships.find(
        (m) => !m.removedAt && m.role === 'owner',
    );
    const ownerUser = owner
        ? (await readModels.usersById.find({ userId: owner.userId }))[0]
        : null;
    const activeMembers = memberships.filter((m) => !m.removedAt);

    const plan = buildSeedPlan();
    const action = seedTenantAction.bind(null, tenantId);
    const impersonation = session.user.impersonation
        ? {
              targetUserId: String(
                  session.user.impersonation.targetUserId,
              ),
              targetEmail:
                  session.user.impersonation.targetEmail ?? undefined,
          }
        : null;

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6 md:p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Admin', href: '/admin' },
                    {
                        label: 'Seed tenant',
                        href: `/admin/seed/${tenantId}?step=1`,
                    },
                    {
                        label:
                            step === 1
                                ? 'Review'
                                : step === 2
                                  ? 'Confirm'
                                  : 'Finalize',
                    },
                ]}
            />
            <SeedWizard
                step={step}
                tenantId={tenantId}
                plan={plan}
                tenant={{
                    tenantId: String(tenant.tenantId),
                    displayName: tenant.displayName,
                    memberCount: activeMembers.length,
                }}
                owner={
                    owner
                        ? {
                              userId: String(owner.userId),
                              email:
                                  (ownerUser?.email as string | undefined) ??
                                  undefined,
                          }
                        : null
                }
                admin={{
                    email: session.user.email ?? 'unknown',
                    isImpersonating: !!impersonation,
                    impersonatingEmail: impersonation?.targetEmail,
                    impersonatingUserId: impersonation?.targetUserId,
                }}
                action={action}
            />
        </main>
    );
}

function parseStep(raw: string | undefined): 1 | 2 | 3 {
    const n = Number(raw ?? '1');
    if (n === 2) return 2;
    if (n === 3) return 3;
    return 1;
}
