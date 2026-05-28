import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    archiveCategoryAction,
    createCategoryAction,
    renameCategoryAction,
    reparentCategoryAction,
} from '@/server/categories';
import type { CategoryDoc } from '@/domains/categories';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/submit-button';
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
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { TagIcon } from 'lucide-react';

type Params = { tenantId: string };

type CategoryNode = CategoryDoc & { children: CategoryNode[]; depth: number };

function buildTree(docs: CategoryDoc[]): CategoryNode[] {
    const byId = new Map<string, CategoryNode>();
    for (const d of docs) {
        byId.set(String(d.categoryId), { ...d, children: [], depth: 0 });
    }
    const roots: CategoryNode[] = [];
    for (const node of byId.values()) {
        const parentId = node.parentId ? String(node.parentId) : undefined;
        if (parentId && byId.has(parentId)) {
            const parent = byId.get(parentId)!;
            node.depth = parent.depth + 1;
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }
    const sortRec = (ns: CategoryNode[]) => {
        ns.sort((a, b) => a.name.localeCompare(b.name));
        ns.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
}

function flatten(roots: CategoryNode[], out: CategoryNode[] = []): CategoryNode[] {
    for (const n of roots) {
        out.push(n);
        flatten(n.children, out);
    }
    return out;
}

/** Categories whose subtree contains `targetId` — invalid as new parents. */
function descendantSet(targetId: string, docs: CategoryDoc[]): Set<string> {
    const children = new Map<string, string[]>();
    for (const d of docs) {
        const p = d.parentId ? String(d.parentId) : undefined;
        if (!p) continue;
        if (!children.has(p)) children.set(p, []);
        children.get(p)!.push(String(d.categoryId));
    }
    const result = new Set<string>([targetId]);
    const stack = [targetId];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        for (const c of children.get(cur) ?? []) {
            if (!result.has(c)) {
                result.add(c);
                stack.push(c);
            }
        }
    }
    return result;
}

export default async function CategoriesPage(props: {
    params: Promise<Params>;
}) {
    const { tenantId } = await props.params;
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const docs = (
        await readModels.categoriesByTenant.find({ tenantId })
    ).filter((c) => !c.isArchived);

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canManage = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin',
    );

    const tree = buildTree(docs);
    const flat = flatten(tree);

    const create = createCategoryAction.bind(null, tenantId);

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Categories' },
                ]}
            />
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Categories
                    </h1>
                    <p className="text-muted-foreground">
                        Tenant:{' '}
                        <Link
                            href={`/tenants/${tenantId}`}
                            className="hover:underline"
                        >
                            {tenant.displayName}
                        </Link>
                    </p>
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Tree</CardTitle>
                </CardHeader>
                <CardContent>
                    {flat.length === 0 ? (
                        <EmptyState
                            icon={<TagIcon />}
                            title="No categories yet"
                            description={
                                canManage
                                    ? 'Create one with the form below.'
                                    : 'Ask an owner or admin to create categories.'
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {flat.map((c) => {
                                const rename = renameCategoryAction.bind(
                                    null,
                                    tenantId,
                                    String(c.categoryId),
                                );
                                const reparent = reparentCategoryAction.bind(
                                    null,
                                    tenantId,
                                    String(c.categoryId),
                                );
                                const archive = archiveCategoryAction.bind(
                                    null,
                                    tenantId,
                                    String(c.categoryId),
                                );
                                const invalidParents = descendantSet(
                                    String(c.categoryId),
                                    docs,
                                );
                                const allowedParents = docs.filter(
                                    (d) => !invalidParents.has(String(d.categoryId)),
                                );
                                return (
                                    <li
                                        key={String(c.categoryId)}
                                        className="flex flex-wrap items-center gap-3 rounded-md border p-3"
                                        style={{
                                            marginLeft: `${c.depth * 1.25}rem`,
                                        }}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="inline-block size-5 rounded-full border"
                                            style={
                                                c.color
                                                    ? {
                                                          backgroundColor:
                                                              c.color,
                                                      }
                                                    : undefined
                                            }
                                        />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate font-medium">
                                                {c.name}
                                            </span>
                                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline">
                                                    {c.categoryType}
                                                </Badge>
                                                {c.icon ? (
                                                    <span className="font-mono">
                                                        {c.icon}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </div>
                                        {canManage ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <form
                                                    action={rename}
                                                    className="flex gap-1"
                                                >
                                                    <Input
                                                        name="name"
                                                        defaultValue={c.name}
                                                        required
                                                        maxLength={120}
                                                        className="h-8 w-40"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        type="submit"
                                                        variant="outline"
                                                    >
                                                        Rename
                                                    </Button>
                                                </form>
                                                <form
                                                    action={reparent}
                                                    className="flex gap-1"
                                                >
                                                    <select
                                                        name="parentId"
                                                        defaultValue={
                                                            c.parentId
                                                                ? String(
                                                                      c.parentId,
                                                                  )
                                                                : ''
                                                        }
                                                        className="h-8 rounded-md border bg-background px-2 text-sm"
                                                    >
                                                        <option value="">
                                                            (no parent)
                                                        </option>
                                                        {allowedParents.map(
                                                            (p) => (
                                                                <option
                                                                    key={String(
                                                                        p.categoryId,
                                                                    )}
                                                                    value={String(
                                                                        p.categoryId,
                                                                    )}
                                                                >
                                                                    {p.name}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <Button
                                                        size="sm"
                                                        type="submit"
                                                        variant="outline"
                                                    >
                                                        Move
                                                    </Button>
                                                </form>
                                                <form action={archive}>
                                                    <Button
                                                        size="sm"
                                                        type="submit"
                                                        variant="ghost"
                                                    >
                                                        Archive
                                                    </Button>
                                                </form>
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>New category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            action={create}
                            className="grid gap-3 sm:grid-cols-2"
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
                                    {docs.map((p) => (
                                        <option
                                            key={String(p.categoryId)}
                                            value={String(p.categoryId)}
                                        >
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
                                <SubmitButton pendingLabel="Creating…">Create category</SubmitButton>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
        </main>
    );
}
