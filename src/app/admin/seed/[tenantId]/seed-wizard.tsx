'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SeedPlan } from '@/server/admin-seed';

interface Props {
    step: 1 | 2 | 3;
    tenantId: string;
    plan: SeedPlan;
    tenant: { tenantId: string; displayName: string; memberCount: number };
    owner: { userId: string; email?: string } | null;
    admin: {
        email: string;
        isImpersonating: boolean;
        impersonatingEmail?: string;
        impersonatingUserId?: string;
    };
    action: (formData: FormData) => Promise<void> | void;
}

/**
 * Three-stage gate before the seed runs. Each phase has a single
 * forward action and (where possible) a link back to the previous
 * phase. Phase 3's Submit button is disabled until the impersonation
 * acknowledgement checkbox is ticked when admin is impersonating.
 */
export function SeedWizard({
    step,
    tenantId,
    plan,
    tenant,
    owner,
    admin,
    action,
}: Props) {
    if (step === 1) return <PhaseReview {...{ tenantId, plan, tenant }} />;
    if (step === 2) return <PhaseConfirm {...{ tenantId, plan, tenant }} />;
    return (
        <PhaseFinalize
            {...{ tenantId, plan, tenant, owner, admin, action }}
        />
    );
}

function PhaseReview({
    tenantId,
    plan,
    tenant,
}: {
    tenantId: string;
    plan: SeedPlan;
    tenant: Props['tenant'];
}) {
    const total = plan.items.reduce((s, i) => s + i.count, 0);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Phase 1 · Review</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Seeding tenant <strong>{tenant.displayName}</strong> will
                    create <strong>{total}</strong> records:
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2">
                    {plan.items.map((i) => (
                        <li
                            key={i.kind}
                            className="flex items-center justify-between rounded-md border p-3"
                        >
                            <div>
                                <p className="text-sm font-medium">
                                    {i.kind}
                                </p>
                                {i.note ? (
                                    <p className="text-xs text-muted-foreground">
                                        {i.note}
                                    </p>
                                ) : null}
                            </div>
                            <Badge variant="outline" className="text-xs">
                                ×{i.count}
                            </Badge>
                        </li>
                    ))}
                </ul>
                <div className="flex justify-between gap-2 pt-2">
                    <Link href="/admin">
                        <Button variant="ghost">Cancel</Button>
                    </Link>
                    <Link href={`/admin/seed/${tenantId}?step=2`}>
                        <Button>Continue → Confirm</Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function PhaseConfirm({
    tenantId,
    plan,
    tenant,
}: {
    tenantId: string;
    plan: SeedPlan;
    tenant: Props['tenant'];
}) {
    const total = plan.items.reduce((s, i) => s + i.count, 0);
    return (
        <Card className="border-amber-500/50">
            <CardHeader>
                <CardTitle>Phase 2 · Confirm</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Are you sure?{' '}
                    <strong>This action is not reversible.</strong>
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
                <p>
                    You're about to write <strong>{total}</strong> records
                    into tenant <strong>{tenant.displayName}</strong>.
                    Once seeded, the only way to remove them is per-
                    record or by dropping the database.
                </p>
                <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                    <li>Seeded transactions will count toward budgets.</li>
                    <li>
                        Seeded recurring templates will start
                        materializing on their next due date.
                    </li>
                    <li>
                        Read-model projections will rebuild on next event
                        publish.
                    </li>
                </ul>
                <div className="flex justify-between gap-2 pt-2">
                    <Link href={`/admin/seed/${tenantId}?step=1`}>
                        <Button variant="ghost">← Back</Button>
                    </Link>
                    <Link href={`/admin/seed/${tenantId}?step=3`}>
                        <Button variant="default">
                            Yes, continue → Finalize
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function PhaseFinalize({
    tenantId,
    plan,
    tenant,
    owner,
    admin,
    action,
}: Omit<Props, 'step'>) {
    const [ack, setAck] = useState(false);
    const canSubmit = !admin.isImpersonating || ack;
    const total = plan.items.reduce((s, i) => s + i.count, 0);

    return (
        <Card className="border-emerald-500/40">
            <CardHeader>
                <CardTitle>Phase 3 · Finalize</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Last gate. Verify the target then run the seed.
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <section className="rounded-md border bg-muted/30 p-4">
                    <h3 className="mb-3 text-sm font-semibold">
                        Target tenant
                    </h3>
                    <dl className="grid grid-cols-3 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">Tenant</dt>
                        <dd className="col-span-2 font-medium">
                            {tenant.displayName}
                        </dd>
                        <dt className="text-muted-foreground">Tenant id</dt>
                        <dd className="col-span-2 truncate font-mono text-xs">
                            {tenant.tenantId}
                        </dd>
                        <dt className="text-muted-foreground">Owner</dt>
                        <dd className="col-span-2">
                            {owner?.email ?? owner?.userId ?? '(no owner)'}
                        </dd>
                        <dt className="text-muted-foreground">
                            Active members
                        </dt>
                        <dd className="col-span-2">{tenant.memberCount}</dd>
                    </dl>
                </section>

                <section className="rounded-md border bg-muted/30 p-4">
                    <h3 className="mb-3 text-sm font-semibold">
                        Acting as
                    </h3>
                    <dl className="grid grid-cols-3 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">Admin</dt>
                        <dd className="col-span-2">{admin.email}</dd>
                        <dt className="text-muted-foreground">
                            Impersonating
                        </dt>
                        <dd className="col-span-2">
                            {admin.isImpersonating ? (
                                <Badge
                                    variant="outline"
                                    className="border-amber-500 text-amber-700 dark:text-amber-300"
                                >
                                    {admin.impersonatingEmail ??
                                        admin.impersonatingUserId ??
                                        'unknown user'}
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground">
                                    not impersonating
                                </span>
                            )}
                        </dd>
                    </dl>
                </section>

                {admin.isImpersonating ? (
                    <label className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-50/40 p-3 text-sm dark:bg-amber-950/20">
                        <input
                            type="checkbox"
                            checked={ack}
                            onChange={(e) => setAck(e.target.checked)}
                        />
                        <span>
                            I confirm I'm impersonating{' '}
                            <strong>
                                {admin.impersonatingEmail ?? 'this user'}
                            </strong>{' '}
                            and intend to seed{' '}
                            <strong>{tenant.displayName}</strong> on their
                            behalf.
                        </span>
                    </label>
                ) : null}

                <p className="text-xs text-muted-foreground">
                    Will create {total} records.
                </p>

                <form
                    action={(fd) => action(fd)}
                    className="flex justify-between gap-2 pt-2"
                >
                    <input type="hidden" name="confirm" value="seed" />
                    {admin.isImpersonating ? (
                        <input
                            type="hidden"
                            name="impersonatingAck"
                            value={ack ? 'yes' : 'no'}
                        />
                    ) : null}
                    <Link href={`/admin/seed/${tenantId}?step=2`}>
                        <Button variant="ghost" type="button">
                            ← Back
                        </Button>
                    </Link>
                    <Button
                        type="submit"
                        disabled={!canSubmit}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        Seed tenant
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
