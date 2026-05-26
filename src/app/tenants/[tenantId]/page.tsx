import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    inviteMemberAction,
    renameTenantAction,
} from '@/server/tenants';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { UsersIcon } from 'lucide-react';

type Params = { tenantId: string };

export default async function TenantDetailPage(props: {
    params: Promise<Params>;
}) {
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
        myMembership && (myMembership.role === 'owner' || myMembership.role === 'admin');

    const rename = renameTenantAction.bind(null, tenantId);
    const invite = inviteMemberAction.bind(null, tenantId);

    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {tenant.displayName}
                    </h1>
                    {tenant.description ? (
                        <p className="text-muted-foreground">
                            {tenant.description}
                        </p>
                    ) : null}
                </div>
                <Link href={`/tenants/${tenantId}/members`}>
                    <Button variant="outline">Manage members</Button>
                </Link>
            </header>

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Rename tenant</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={rename} className="flex gap-3">
                            <Input
                                name="displayName"
                                defaultValue={tenant.displayName}
                                required
                                maxLength={120}
                            />
                            <Button type="submit">Save</Button>
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>Members</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {memberships.length === 0 ? (
                        <EmptyState
                            icon={<UsersIcon />}
                            title="No members yet"
                            description={
                                canManage
                                    ? 'Invite someone with the form below to get started.'
                                    : 'Ask an owner or admin to invite people.'
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {memberships.map((m) => (
                                <li
                                    key={m.membershipId}
                                    className="flex items-center justify-between gap-3 rounded-md border p-3"
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
                                    <Badge variant="outline">{m.role}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Invite a member</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={invite} className="flex flex-col gap-3 sm:flex-row">
                            <div className="flex flex-1 flex-col gap-1.5">
                                <Label htmlFor="email" className="text-sm">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="teammate@example.com"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="role" className="text-sm">
                                    Role
                                </Label>
                                <select
                                    id="role"
                                    name="role"
                                    defaultValue="member"
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="viewer">viewer</option>
                                    <option value="member">member</option>
                                    <option value="admin">admin</option>
                                </select>
                            </div>
                            <Button type="submit" className="self-end">
                                Invite
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
