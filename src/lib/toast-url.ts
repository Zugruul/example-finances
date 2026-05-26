type ToastKind = 'success' | 'error' | 'info' | 'warning';

export function withToast(
    path: string,
    kind: ToastKind,
    message: string,
): string {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}toast=${kind}&msg=${encodeURIComponent(message)}`;
}
