import Link from 'next/link';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export default async function TenantsPage() {
    const session = await auth();
    const userId = session?.user?.id;

    const myMemberships = userId
        ? (await readModels.memberships.find({ userId })).filter(
              (m) => !m.removedAt,
          )
        : [];

    const tenants = await Promise.all(
        myMemberships.map(async (m) => ({
            membership: m,
            tenant: (
                await readModels.tenants.find({ tenantId: m.tenantId })
            )[0],
        })),
    );

    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
            <header className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Tenants
                </h1>
                <Link href="/tenants/new">
                    <Button>Create tenant</Button>
                </Link>
            </header>

            {tenants.length === 0 ? (
                <Card>
                    <CardContent className="p-6 text-muted-foreground">
                        You don&apos;t belong to any tenants yet.
                    </CardContent>
                </Card>
            ) : (
                <ul className="flex flex-col gap-3">
                    {tenants.map(({ tenant, membership }) =>
                        tenant ? (
                            <li key={membership.membershipId}>
                                <Link href={`/tenants/${tenant.tenantId}`}>
                                    <Card className="transition-colors hover:bg-muted/50">
                                        <CardHeader>
                                            <CardTitle>
                                                {tenant.displayName}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm text-muted-foreground">
                                            Role: {membership.role}
                                        </CardContent>
                                    </Card>
                                </Link>
                            </li>
                        ) : null,
                    )}
                </ul>
            )}
        </main>
    );
}
