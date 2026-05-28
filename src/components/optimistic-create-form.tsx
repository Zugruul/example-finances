'use client';

import {
    useOptimistic,
    type ReactNode,
    type FormHTMLAttributes,
} from 'react';

/**
 * Shared scaffold for "create-an-item" forms whose newly-created row
 * lives in a server-rendered list on the same page. The pattern is:
 *
 *   <OptimisticCreateForm
 *       action={create}
 *       buildGhost={(fd) => ({ id: tempId, name: fd.get('name'), ... })}
 *       renderGhosts={(ghosts) => <YourGhostList items={ghosts} />}
 *   >
 *     ...your form fields + <SubmitButton>...
 *   </OptimisticCreateForm>
 *
 * On submit, `buildGhost` is called with the FormData. If it returns
 * a non-null value, the value is pushed into a `useOptimistic` list.
 * `renderGhosts` is called with the current list — typically rendered
 * above the form, or anywhere the consumer wants the pending items
 * to appear.
 *
 * React auto-clears the pending list when the form-action's
 * transition resolves (server returns + soft-nav lands with the real
 * row in the server-rendered list).
 *
 * Use this when the parent server component owns the list rendering
 * and you don't want to lift the whole list into a client component
 * just to thread useOptimistic through it. For richer integration
 * (ghost row merged into the SAME list as the real rows, with the
 * list's chain/state logic applied), see
 * `tenants/[id]/transactions/transactions-optimistic.tsx`.
 */
export function OptimisticCreateForm<TGhost extends { id: string }>({
    action,
    buildGhost,
    renderGhosts,
    children,
    formProps,
}: {
    action: (formData: FormData) => Promise<void> | void;
    buildGhost: (formData: FormData) => TGhost | null;
    renderGhosts: (ghosts: TGhost[]) => ReactNode;
    children: ReactNode;
    formProps?: Omit<FormHTMLAttributes<HTMLFormElement>, 'action'>;
}) {
    const [ghosts, addGhost] = useOptimistic<TGhost[], TGhost>(
        [],
        (state, g) => [g, ...state],
    );

    async function wrapped(formData: FormData) {
        const ghost = buildGhost(formData);
        if (ghost) addGhost(ghost);
        await action(formData);
    }

    return (
        <>
            {ghosts.length > 0 ? renderGhosts(ghosts) : null}
            <form action={wrapped} {...formProps}>
                {children}
            </form>
        </>
    );
}

/** Convenience for ghost ids. */
export function makeGhostId(prefix = 'optimistic'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
