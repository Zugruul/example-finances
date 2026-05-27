import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    changeMemberRoleByFormAction,
    removeMemberByFormAction,
} from '@/server/tenants';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import type { MembershipRole } from '@/domains/tenants';

type Params = { tenantId: string };

const ROLES: MembershipRole[] = ['owner', 'admin', 'member', 'viewer'];

export default async function MembersPage(props: { params: Promise<Params> }) {
    const { tenantId } = await props.params;
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const memberships = (
        await readModels.memberships.find({ tenantId })
    ).filter((m) => !m.removedAt);

    const myMembership =
        userId && memberships.find((m) => m.userId === userId);
    const canManage =
        myMembership &&
        (myMembership.role === 'owner' || myMembership.role === 'admin');

    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Members' },
                ]}
            />
            <h1 className="text-2xl font-semibold tracking-tight">
                Members of {tenant.displayName}
            </h1>

            <Card>
                <CardHeader>
                    <CardTitle>{memberships.length} member(s)</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {memberships.map((m) => (
                        <div
                            key={m.membershipId}
                            className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex flex-col">
                                <span className="font-medium">
                                    {m.displayName ?? m.invitedEmail}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {m.joinedAt
                                        ? `Joined ${new Date(m.joinedAt).toLocaleDateString()}`
                                        : 'Invitation pending'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {canManage ? (
                                    <>
                                        <form action={changeMemberRoleByFormAction}>
                                            <input
                                                type="hidden"
                                                name="tenantId"
                                                value={tenantId}
                                            />
                                            <input
                                                type="hidden"
                                                name="membershipId"
                                                value={m.membershipId}
                                            />
                                            <select
                                                name="role"
                                                defaultValue={m.role}
                                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                            >
                                                {ROLES.map((r) => (
                                                    <option key={r} value={r}>
                                                        {r}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button
                                                type="submit"
                                                variant="outline"
                                                size="sm"
                                                className="ml-2"
                                            >
                                                Update
                                            </Button>
                                        </form>
                                        <form action={removeMemberByFormAction}>
                                            <input
                                                type="hidden"
                                                name="tenantId"
                                                value={tenantId}
                                            />
                                            <input
                                                type="hidden"
                                                name="membershipId"
                                                value={m.membershipId}
                                            />
                                            <Button
                                                type="submit"
                                                variant="destructive"
                                                size="sm"
                                            >
                                                Remove
                                            </Button>
                                        </form>
                                    </>
                                ) : (
                                    <span className="text-sm text-muted-foreground">
                                        {m.role}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </main>
    );
}
