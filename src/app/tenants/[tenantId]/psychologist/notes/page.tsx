import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { readModels } from '@/sorc';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { EmptyState } from '@/components/empty-state';
import { BreadcrumbBar } from '@/components/breadcrumb-bar';
import { NotebookPenIcon, LockIcon } from 'lucide-react';
import Link from 'next/link';
import {
    createPsychologistNoteAction,
    lockPsychologistNoteAction,
    updatePsychologistNoteAction,
} from '@/server/psychologist';
import { Button } from '@/components/ui/button';
import { NoteEditForm } from './note-edit-form';
import { NewNoteForm } from './new-note-form';
import { DraftsBanner } from './drafts-banner';
import { DraftBadge } from './draft-badge';

type Params = { tenantId: string };
type SearchParams = { edit?: string };

export const dynamic = 'force-dynamic';

export default async function PsychologistNotesPage(props: {
    params: Promise<Params>;
    searchParams: Promise<SearchParams>;
}) {
    const { tenantId } = await props.params;
    const sp = await props.searchParams;
    const editingNoteId = sp.edit ?? null;
    const session = await auth();
    const userId = session?.user?.id;

    const [tenant] = await readModels.tenants.find({ tenantId });
    if (!tenant) notFound();

    const memberships = userId
        ? (await readModels.memberships.find({ tenantId, userId })).filter(
              (m) => !m.removedAt,
          )
        : [];
    const canManage = memberships.some(
        (m) => m.role === 'owner' || m.role === 'admin' || m.role === 'member',
    );

    const [clients, sessions, notes] = await Promise.all([
        readModels.psychologistClients.find({ tenantId }),
        readModels.psychologistSessions.find({ tenantId }),
        readModels.psychologistNotes.find({ tenantId }),
    ]);
    const activeClients = clients.filter((c) => !c.isArchived);
    const clientById = new Map(
        clients.map((c) => [String(c.clientId), c]),
    );
    const sessionById = new Map(
        sessions.map((s) => [String(s.sessionId), s]),
    );
    const sortedNotes = [...notes].sort(
        (a, b) =>
            new Date(b.authoredAt).getTime() - new Date(a.authoredAt).getTime(),
    );

    const create = createPsychologistNoteAction.bind(null, tenantId);

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
            <BreadcrumbBar
                items={[
                    { label: 'Tenants', href: '/tenants' },
                    {
                        label: tenant.displayName,
                        href: `/tenants/${tenantId}`,
                    },
                    { label: 'Psychologist' },
                    { label: 'Notes' },
                ]}
            />
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Clinical notes
                </h1>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LockIcon className="size-3.5" />
                    Note title + body are encrypted on disk via cryptoshredding.
                    Once locked a note can't be edited (audit trail).
                </p>
            </header>

            <DraftsBanner
                tenantId={tenantId}
                clientNames={Object.fromEntries(
                    clients.map((c) => [
                        String(c.clientId),
                        `${c.firstName} ${c.lastName}`,
                    ]),
                )}
                noteTitles={Object.fromEntries(
                    sortedNotes.map((n) => [String(n.noteId), n.title]),
                )}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Notes ({sortedNotes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {sortedNotes.length === 0 ? (
                        <EmptyState
                            icon={<NotebookPenIcon />}
                            title="No notes yet"
                            description="Write your first clinical note below."
                        />
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {sortedNotes.map((n) => {
                                const c = clientById.get(String(n.clientId));
                                const s = n.sessionId
                                    ? sessionById.get(String(n.sessionId))
                                    : undefined;
                                return (
                                    <li
                                        key={String(n.noteId)}
                                        className="rounded-md border p-3"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="flex min-w-0 flex-col">
                                                <span className="flex items-center gap-2 font-medium">
                                                    {n.title}
                                                    {!n.isLocked ? (
                                                        <DraftBadge
                                                            tenantId={tenantId}
                                                            noteId={String(n.noteId)}
                                                        />
                                                    ) : null}
                                                </span>
                                                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    <span>
                                                        {c
                                                            ? `${c.firstName} ${c.lastName}`
                                                            : '(client deleted)'}
                                                    </span>
                                                    {s ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px]"
                                                        >
                                                            session{' '}
                                                            <span
                                                                suppressHydrationWarning
                                                            >
                                                                {new Date(
                                                                    s.startsAt,
                                                                ).toLocaleDateString()}
                                                            </span>
                                                        </Badge>
                                                    ) : null}
                                                    <span
                                                        suppressHydrationWarning
                                                    >
                                                        {new Date(
                                                            n.authoredAt,
                                                        ).toLocaleString()}
                                                    </span>
                                                    {n.isLocked ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] border-emerald-500/50"
                                                        >
                                                            locked
                                                        </Badge>
                                                    ) : null}
                                                </span>
                                            </div>
                                            {canManage && !n.isLocked ? (
                                                <div className="flex gap-1">
                                                    {editingNoteId !==
                                                    String(n.noteId) ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            nativeButton={false}
                                                            render={
                                                                <Link
                                                                    href={`/tenants/${tenantId}/psychologist/notes?edit=${n.noteId}#note-${n.noteId}`}
                                                                >
                                                                    Edit
                                                                </Link>
                                                            }
                                                        />
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            nativeButton={false}
                                                            render={
                                                                <Link
                                                                    href={`/tenants/${tenantId}/psychologist/notes`}
                                                                >
                                                                    Cancel
                                                                </Link>
                                                            }
                                                        />
                                                    )}
                                                    <form
                                                        action={lockPsychologistNoteAction.bind(
                                                            null,
                                                            tenantId,
                                                            String(n.noteId),
                                                        )}
                                                    >
                                                        <SubmitButton
                                                            size="sm"
                                                            variant="ghost"
                                                            pendingLabel="Locking…"
                                                        >
                                                            Lock
                                                        </SubmitButton>
                                                    </form>
                                                </div>
                                            ) : null}
                                        </div>
                                        {editingNoteId === String(n.noteId) &&
                                        canManage &&
                                        !n.isLocked ? (
                                            <div id={`note-${n.noteId}`}>
                                                <NoteEditForm
                                                    tenantId={tenantId}
                                                    noteId={String(n.noteId)}
                                                    initialTitle={n.title}
                                                    initialBody={n.body}
                                                    action={updatePsychologistNoteAction.bind(
                                                        null,
                                                        tenantId,
                                                        String(n.noteId),
                                                    )}
                                                />
                                            </div>
                                        ) : (
                                            <p className="mt-2 whitespace-pre-wrap text-sm">
                                                {n.body}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {canManage && activeClients.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>New note</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <NewNoteForm
                            tenantId={tenantId}
                            clients={activeClients.map((c) => ({
                                clientId: String(c.clientId),
                                label: `${c.firstName} ${c.lastName}`,
                            }))}
                            sessions={sessions.map((s) => ({
                                sessionId: String(s.sessionId),
                                clientId: String(s.clientId),
                                label: new Date(s.startsAt).toLocaleString(),
                            }))}
                            action={create}
                        />
                    </CardContent>
                </Card>
            ) : null}

            {activeClients.length === 0 && canManage ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Add a client first to record notes.
                </p>
            ) : null}
        </main>
    );
}
