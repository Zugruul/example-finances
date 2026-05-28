'use client';

import { useFormStatus } from 'react-dom';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A drop-in submit button that reads the parent <form>'s pending state
 * via React 19's `useFormStatus` hook. While the server action is in
 * flight (including the redirect that follows), the button disables
 * itself and swaps in a spinner + the `pendingLabel` (or `children`
 * with a spinner prefix when no pendingLabel is provided).
 *
 * Use anywhere a server-action form wants instant feedback without
 * lifting state to a wrapper. For full optimistic UI (ghost-row
 * preview, etc.), wire `useOptimistic` in the parent instead — this
 * button covers the cheaper "the click registered, hang on" case.
 */
export function SubmitButton({
    children,
    pendingLabel,
    ...props
}: React.ComponentProps<typeof Button> & {
    pendingLabel?: React.ReactNode;
}) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} {...props}>
            {pending ? (
                <>
                    <Loader2Icon className="size-4 animate-spin" />
                    {pendingLabel ?? children}
                </>
            ) : (
                children
            )}
        </Button>
    );
}
