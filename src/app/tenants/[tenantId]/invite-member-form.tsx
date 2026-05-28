'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import {
    OptimisticCreateForm,
    makeGhostId,
} from '@/components/optimistic-create-form';

type InviteGhost = {
    id: string;
    email: string;
    role: string;
};

export function InviteMemberForm({
    action,
}: {
    action: (formData: FormData) => Promise<void> | void;
}) {
    return (
        <OptimisticCreateForm<InviteGhost>
            action={action}
            buildGhost={(fd) => {
                const email = String(fd.get('email') ?? '')
                    .trim()
                    .toLowerCase();
                if (!email) return null;
                const role = String(fd.get('role') ?? 'member');
                return { id: makeGhostId('inv'), email, role };
            }}
            renderGhosts={(ghosts) => (
                <ul className="mb-3 flex flex-col gap-2">
                    {ghosts.map((g) => (
                        <li
                            key={g.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-sky-50/60 p-3 dark:bg-sky-900/20"
                        >
                            <div className="flex min-w-0 flex-col">
                                <span className="font-medium">{g.email}</span>
                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">{g.role}</Badge>
                                    <span>Invitation pending</span>
                                </span>
                            </div>
                            <Badge
                                variant="outline"
                                className="text-[10px] border-sky-500/60 text-sky-700 dark:text-sky-300"
                            >
                                inviting…
                            </Badge>
                        </li>
                    ))}
                </ul>
            )}
            formProps={{ className: 'flex flex-col gap-3 sm:flex-row' }}
        >
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
            <SubmitButton className="self-end" pendingLabel="Inviting…">
                Invite
            </SubmitButton>
        </OptimisticCreateForm>
    );
}
