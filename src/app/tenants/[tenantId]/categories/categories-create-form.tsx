'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import {
    OptimisticCreateForm,
    makeGhostId,
} from '@/components/optimistic-create-form';

type ParentOption = { categoryId: string; name: string };
type CategoryGhost = {
    id: string;
    name: string;
    categoryType: string;
    color: string | null;
    icon: string | null;
};

export function CategoriesCreateForm({
    action,
    parents,
}: {
    action: (formData: FormData) => Promise<void> | void;
    parents: ParentOption[];
}) {
    return (
        <OptimisticCreateForm<CategoryGhost>
            action={action}
            buildGhost={(fd) => {
                const name = String(fd.get('name') ?? '').trim();
                if (!name) return null;
                const categoryType = String(
                    fd.get('categoryType') ?? 'expense',
                );
                const color = String(fd.get('color') ?? '').trim() || null;
                const icon = String(fd.get('icon') ?? '').trim() || null;
                return {
                    id: makeGhostId('cat'),
                    name,
                    categoryType,
                    color,
                    icon,
                };
            }}
            renderGhosts={(ghosts) => (
                <ul className="flex flex-col gap-1">
                    {ghosts.map((g) => (
                        <li
                            key={g.id}
                            className="flex flex-wrap items-center gap-3 rounded-md border border-dashed bg-sky-50/60 p-3 dark:bg-sky-900/20"
                        >
                            <span
                                aria-hidden="true"
                                className="inline-block size-5 rounded-full border"
                                style={
                                    g.color
                                        ? { backgroundColor: g.color }
                                        : undefined
                                }
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">
                                    {g.name}
                                </span>
                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">
                                        {g.categoryType}
                                    </Badge>
                                    {g.icon ? (
                                        <span className="font-mono">
                                            {g.icon}
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                            <Badge
                                variant="outline"
                                className="text-[10px] border-sky-500/60 text-sky-700 dark:text-sky-300"
                            >
                                creating…
                            </Badge>
                        </li>
                    ))}
                </ul>
            )}
            formProps={{ className: 'grid gap-3 sm:grid-cols-2' }}
        >
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    name="name"
                    required
                    maxLength={120}
                    placeholder="Groceries"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="categoryType">Type</Label>
                <select
                    id="categoryType"
                    name="categoryType"
                    defaultValue="expense"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    <option value="income">income</option>
                    <option value="expense">expense</option>
                    <option value="transfer">transfer</option>
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="parentId">Parent</Label>
                <select
                    id="parentId"
                    name="parentId"
                    defaultValue=""
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    <option value="">(no parent)</option>
                    {parents.map((p) => (
                        <option key={p.categoryId} value={p.categoryId}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="color">Color</Label>
                <Input
                    id="color"
                    name="color"
                    type="text"
                    placeholder="#3b82f6"
                    pattern="#[0-9a-fA-F]{6}"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="icon">Icon</Label>
                <Input
                    id="icon"
                    name="icon"
                    type="text"
                    placeholder="ShoppingCart"
                />
            </div>
            <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Creating…">
                    Create category
                </SubmitButton>
            </div>
        </OptimisticCreateForm>
    );
}
