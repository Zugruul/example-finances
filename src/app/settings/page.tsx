import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ScrollTextIcon } from 'lucide-react';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { updateDefaultCurrencyAction } from '@/server/users';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/submit-button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { SorcUUID } from '@event-sorcerer/core';

const CURRENCY_OPTIONS = [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'BRL',
    'CAD',
    'AUD',
    'INR',
    'CNY',
    'CHF',
] as const;

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const userId = session.user.id as SorcUUID;
    const profile = await readModels.usersById.findOne({ userId });
    const currentCurrency = profile?.defaultCurrency ?? 'USD';

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col gap-6 p-8">
            <BreadcrumbBar items={[{ label: 'Settings' }]} />
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Settings
                </h1>
                <p className="text-sm text-muted-foreground">
                    Personal preferences applied across your tenants.
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    nativeButton={false}
                    render={
                        <Link href="/settings/audit">
                            <ScrollTextIcon className="size-4" />
                            View settings audit
                        </Link>
                    }
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Default currency for new tenants</CardTitle>
                    <CardDescription>
                        Used as the starting currency when you create a new
                        tenant. Each tenant has its own per-tenant default
                        currency you can change from that tenant's Options
                        page — this user-level setting only seeds new
                        tenants.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        action={updateDefaultCurrencyAction}
                        className="flex flex-col gap-4 sm:flex-row sm:items-end"
                    >
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <Label htmlFor="currency">Currency</Label>
                            <select
                                id="currency"
                                name="currency"
                                defaultValue={currentCurrency}
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                            >
                                {CURRENCY_OPTIONS.map((code) => (
                                    <option key={code} value={code}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
                    </form>
                </CardContent>
            </Card>

        </main>
    );
}
