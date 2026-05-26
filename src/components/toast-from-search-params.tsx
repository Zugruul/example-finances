'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

const KIND_MAP: Record<string, ToastKind> = {
    success: 'success',
    error: 'error',
    info: 'info',
    warning: 'warning',
};

export function ToastFromSearchParams() {
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const fired = useRef<string | null>(null);

    useEffect(() => {
        const kind = params.get('toast');
        const msg = params.get('msg');
        if (!kind || !msg) return;

        const sig = `${kind}|${msg}`;
        if (fired.current === sig) return;
        fired.current = sig;

        const mapped = KIND_MAP[kind] ?? 'info';
        toast[mapped](msg);

        const next = new URLSearchParams(params.toString());
        next.delete('toast');
        next.delete('msg');
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, router, pathname]);

    return null;
}
