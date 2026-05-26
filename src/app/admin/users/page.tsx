import { listAuthUsers } from '@/lib/auth-users';
import {
    startImpersonationAction,
    grantAdminAction,
    removeAdminAction,
} from '@/server/admin';
import { readModels } from '@/sorc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
export default async function AdminUsersPage() {
    const [users, allRoles] = await Promise.all([
        listAuthUsers(200),
        readModels.platformRoles.find({}),
    ]);

    const adminIds = new Set(
        allRoles
            .filter((r) => r.role === 'admin')
            .map((r) => String(r.userId)),
    );

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>

            <Card>
                <CardHeader>
                    <CardTitle>{users.length} user(s)</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {users.length === 0 ? (
                        <p className="text-muted-foreground">
                            No users yet. Sign in once to populate the Auth.js
                            users collection.
                        </p>
                    ) : (
                        users.map((u) => {
                            const userId = String(u._id);
                            const isAdmin = adminIds.has(userId);
                            return (
                                <div
                                    key={userId}
                                    className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex flex-col">
                                        <span className="flex items-center gap-2 font-medium">
                                            {u.name ?? u.email ?? '(no name)'}
                                            {isAdmin && (
                                                <Badge variant="secondary">
                                                    Admin
                                                </Badge>
                                            )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {u.email ?? userId}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {isAdmin ? (
                                            <form action={removeAdminAction}>
                                                <input
                                                    type="hidden"
                                                    name="targetUserId"
                                                    value={userId}
                                                />
                                                <Button
                                                    type="submit"
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    Remove admin
                                                </Button>
                                            </form>
                                        ) : (
                                            <form action={grantAdminAction}>
                                                <input
                                                    type="hidden"
                                                    name="targetUserId"
                                                    value={userId}
                                                />
                                                <Button
                                                    type="submit"
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    Grant admin
                                                </Button>
                                            </form>
                                        )}
                                        <form action={startImpersonationAction}>
                                            <input
                                                type="hidden"
                                                name="targetUserId"
                                                value={userId}
                                            />
                                            <input
                                                type="hidden"
                                                name="targetEmail"
                                                value={u.email ?? ''}
                                            />
                                            <Button
                                                type="submit"
                                                variant="outline"
                                                size="sm"
                                            >
                                                Impersonate
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

