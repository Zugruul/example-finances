import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    archiveAccountAction,
    closeAccountAction,
    renameAccountAction,
} from '@/server/accounts';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/money';

type Params = { tenantId: string; accountId: string };

export default async function AccountDetailPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId, accountId } = await props.params;
    const session = await auth();
    const userId = session?.user?.id;

    const [account] = await readModels.accountsByTenant.find({ accountId });
    if (!account || String(account.tenantId) !== tenantId) notFound();
    const [balance] = await readModels.accountBalance.find({ accountId });
    const ledger = (
        await readModels.transactions.find({ accountId })
    )
        .filter((t) => !t.isDeleted)
        .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1))
        .slice(0, 50);

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canManage = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin',
    );

    const rename = renameAccountAction.bind(null, tenantId, accountId);
    const archive = archiveAccountAction.bind(null, tenantId, accountId);
    const close = closeAccountAction.bind(null, tenantId, accountId);

    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <Link
                        href={`/tenants/${tenantId}/accounts`}
                        className="text-xs text-muted-foreground hover:underline"
                    >
                        ← All accounts
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {account.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{account.accountType}</Badge>
                        <span>{account.currency}</span>
                        {account.isArchived ? (
                            <Badge variant="secondary">archived</Badge>
                        ) : null}
                        {account.isClosed ? (
                            <Badge variant="destructive">closed</Badge>
                        ) : null}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                        Balance
                    </div>
                    <div className="font-mono text-2xl tabular-nums">
                        {formatMoney(
                            balance?.balance ?? account.openingBalance,
                            account.currency,
                        )}
                    </div>
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Ledger</CardTitle>
                </CardHeader>
                <CardContent>
                    {ledger.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No transactions on this account yet.{' '}
                            <Link
                                href={`/tenants/${tenantId}/transactions`}
                                className="hover:underline"
                            >
                                Record one →
                            </Link>
                        </p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-muted-foreground">
                                <tr className="border-b">
                                    <th className="px-2 py-2 text-left">
                                        Date
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Description
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                        Type
                                    </th>
                                    <th className="px-2 py-2 text-right">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map((t) => {
                                    const sign =
                                        t.transactionType === 'income' ? '+' : '−';
                                    return (
                                        <tr
                                            key={String(t.transactionId)}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="px-2 py-2 font-mono text-xs">
                                                {t.occurredOn}
                                            </td>
                                            <td className="px-2 py-2">
                                                <Link
                                                    href={`/tenants/${tenantId}/transactions/${t.transactionId}`}
                                                    className="hover:underline"
                                                >
                                                    {t.description ?? '—'}
                                                </Link>
                                            </td>
                                            <td className="px-2 py-2">
                                                <Badge variant="outline">
                                                    {t.transactionType}
                                                </Badge>
                                            </td>
                                            <td className="px-2 py-2 text-right font-mono tabular-nums">
                                                {t.transactionType ===
                                                'transfer'
                                                    ? formatMoney(
                                                          t.amount,
                                                          t.currency,
                                                      )
                                                    : `${sign}${formatMoney(t.amount, t.currency)}`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {canManage && !account.isClosed ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Rename</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={rename} className="flex gap-3">
                            <Input
                                name="name"
                                defaultValue={account.name}
                                required
                                maxLength={120}
                            />
                            <Button type="submit">Save</Button>
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Lifecycle</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        {!account.isArchived && !account.isClosed ? (
                            <form action={archive}>
                                <Button variant="outline" type="submit">
                                    Archive account
                                </Button>
                            </form>
                        ) : null}
                        {!account.isClosed ? (
                            <form action={close}>
                                <Button variant="destructive" type="submit">
                                    Close account
                                </Button>
                            </form>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
