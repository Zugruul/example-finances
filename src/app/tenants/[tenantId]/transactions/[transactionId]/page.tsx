import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    deleteTransactionAction,
    updateTransactionAction,
} from '@/server/transactions';
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
import { formatMoney, minorUnitsToMajor } from '@/lib/money';

type Params = { tenantId: string; transactionId: string };

export default async function TransactionDetailPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId, transactionId } = await props.params;
    const session = await auth();
    const userId = session?.user?.id;

    const [tx] = await readModels.transactions.find({ transactionId });
    if (!tx || String(tx.tenantId) !== tenantId) notFound();

    const [account] = await readModels.accountsByTenant.find({
        accountId: tx.accountId,
    });
    const categories = await readModels.categoriesByTenant.find({ tenantId });

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canEdit = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin' || m.role === 'member',
    );

    const update = updateTransactionAction.bind(null, tenantId, transactionId);
    const remove = deleteTransactionAction.bind(null, tenantId, transactionId);

    const amountMajor = minorUnitsToMajor(tx.amount, tx.currency).toFixed(2);

    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <Link
                        href={`/tenants/${tenantId}/transactions`}
                        className="text-xs text-muted-foreground hover:underline"
                    >
                        ← All transactions
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {tx.description ?? '(no description)'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{tx.transactionType}</Badge>
                        <span className="font-mono">{tx.occurredOn}</span>
                        {tx.isDeleted ? (
                            <Badge variant="destructive">deleted</Badge>
                        ) : null}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-muted-foreground">Amount</div>
                    <div className="font-mono text-2xl tabular-nums">
                        {formatMoney(tx.amount, tx.currency)}
                    </div>
                    {account ? (
                        <Link
                            href={`/tenants/${tenantId}/accounts/${tx.accountId}`}
                            className="text-xs text-muted-foreground hover:underline"
                        >
                            {account.name}
                        </Link>
                    ) : null}
                </div>
            </header>

            {canEdit &&
            !tx.isDeleted &&
            tx.transactionType !== 'transfer' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Edit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            action={update}
                            className="grid gap-3 sm:grid-cols-2"
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="text"
                                    inputMode="decimal"
                                    defaultValue={amountMajor}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="occurredOn">Date</Label>
                                <Input
                                    id="occurredOn"
                                    name="occurredOn"
                                    type="date"
                                    defaultValue={tx.occurredOn}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    defaultValue={tx.description ?? ''}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <Label htmlFor="categoryId">Category</Label>
                                <select
                                    id="categoryId"
                                    name="categoryId"
                                    defaultValue={
                                        tx.categoryId
                                            ? String(tx.categoryId)
                                            : ''
                                    }
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="">(none)</option>
                                    {categories
                                        .filter((c) => !c.isArchived)
                                        .map((c) => (
                                            <option
                                                key={String(c.categoryId)}
                                                value={String(c.categoryId)}
                                            >
                                                {c.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <Button type="submit">Save</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}

            {canEdit && !tx.isDeleted ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Danger</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={remove}>
                            <Button variant="destructive" type="submit">
                                Delete transaction
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
