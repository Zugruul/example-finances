import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { EmptyState } from '@/components/empty-state';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { UsersIcon, LockIcon } from 'lucide-react';
import { createClientAction, archiveClientAction } from '@/server/clients';
import { Button } from '@/components/ui/button';

type Params = { tenantId: string };

export const dynamic = 'force-dynamic';

export default async function ClientsPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId } = await props.params;
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    // Tenant-scoped — the route guard in tenants/[tenantId]/layout.tsx
    // already enforces membership AND module install state, so reads
    // below are safe.
    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canManage = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin' || m.role === 'member',
    );

    const clients = (
        await readModels.clientsByTenant.find({ tenantId })
    ).filter((c) => !c.isArchived);

    const create = createClientAction.bind(null, tenantId);

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Clients' },
                ]}
            />
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Clients
                    </h1>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LockIcon className="size-3.5" />
                        Every PII field is cryptoshredded — dropping this
                        tenant's key renders all stored personal data
                        permanently unreadable.
                    </p>
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>
                        Roster ({clients.length}
                        {clients.length === 1 ? ' client' : ' clients'})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {clients.length === 0 ? (
                        <EmptyState
                            icon={<UsersIcon />}
                            title="No clients yet"
                            description={
                                canManage
                                    ? 'Add your first client with the form below.'
                                    : 'Ask an owner or admin to add clients.'
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {clients.map((c) => (
                                <li
                                    key={String(c.clientId)}
                                    id={`cli-${c.clientId}`}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                                >
                                    <div className="flex min-w-0 flex-col">
                                        <span className="font-medium">
                                            {c.firstName} {c.lastName}
                                        </span>
                                        <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                            {c.email ? (
                                                <span>{c.email}</span>
                                            ) : null}
                                            {c.phone ? (
                                                <span>{c.phone}</span>
                                            ) : null}
                                            {c.dateOfBirth ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px]"
                                                >
                                                    DOB {c.dateOfBirth}
                                                </Badge>
                                            ) : null}
                                        </span>
                                    </div>
                                    {canManage ? (
                                        <form
                                            action={archiveClientAction.bind(
                                                null,
                                                tenantId,
                                                String(c.clientId),
                                            )}
                                        >
                                            <SubmitButton
                                                size="sm"
                                                variant="ghost"
                                                pendingLabel="Archiving…"
                                            >
                                                Archive
                                            </SubmitButton>
                                        </form>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Add a client</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            action={create}
                            className="grid gap-3 sm:grid-cols-2"
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="firstName">First name</Label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    required
                                    maxLength={120}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="lastName">Last name</Label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    required
                                    maxLength={120}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="client@example.com"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    name="address"
                                    placeholder="123 Main St, City, State ZIP"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="dateOfBirth">
                                    Date of birth
                                </Label>
                                <Input
                                    id="dateOfBirth"
                                    name="dateOfBirth"
                                    type="date"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="notes">Intake notes</Label>
                                <textarea
                                    id="notes"
                                    name="notes"
                                    rows={3}
                                    className="rounded-md border bg-background px-3 py-2 text-sm"
                                    placeholder="Anything to remember…"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <SubmitButton pendingLabel="Adding…">
                                    Add client
                                </SubmitButton>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
