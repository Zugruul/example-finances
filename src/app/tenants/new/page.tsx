import { createTenantAction } from '@/server/tenants';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewTenantPage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
            <h1 className="text-2xl font-semibold tracking-tight">
                Create a tenant
            </h1>
            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form action={createTenantAction} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="displayName">Name</Label>
                            <Input
                                id="displayName"
                                name="displayName"
                                required
                                maxLength={120}
                                placeholder="Acme Corp"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="description">Description (optional)</Label>
                            <Input
                                id="description"
                                name="description"
                                maxLength={500}
                                placeholder="Operating budget tracker"
                            />
                        </div>
                        <Button type="submit">Create tenant</Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
