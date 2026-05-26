import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import { updateProfileAction } from '@/server/users';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SorcUUID } from '@event-sorcerer/core';

export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/auth/signin');

    const userId = session.user.id as SorcUUID;
    const profile = await readModels.usersById.findOne({ userId });

    // Cryptoshredding placeholder — if the user's encryption key has been
    // shredded (post-deletion), the plugin substitutes `[CRYPTO_SHREDDED]`
    // for PII fields. We don't pre-populate the form in that case.
    const SHREDDED = '[CRYPTO_SHREDDED]';
    const shredded = (v?: string) => (v === SHREDDED ? '' : (v ?? ''));

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col gap-6 p-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Your profile
                </h1>
                <p className="text-sm text-muted-foreground">
                    Personal details for{' '}
                    <span className="font-medium">{session.user.email}</span>.
                    All fields are encrypted at rest (GDPR crypto-shredding).
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Personal information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        action={updateProfileAction}
                        className="flex flex-col gap-4"
                    >
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="firstName">First name</Label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    defaultValue={shredded(profile?.firstName)}
                                    maxLength={120}
                                    placeholder="Ada"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="lastName">Last name</Label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    defaultValue={shredded(profile?.lastName)}
                                    maxLength={120}
                                    placeholder="Lovelace"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="phoneNumber">Phone number</Label>
                            <Input
                                id="phoneNumber"
                                name="phoneNumber"
                                type="tel"
                                defaultValue={shredded(profile?.phoneNumber)}
                                maxLength={40}
                                placeholder="+1 555 0100"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                name="address"
                                defaultValue={shredded(profile?.address)}
                                maxLength={500}
                                placeholder="221B Baker Street, London"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit">Save changes</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
