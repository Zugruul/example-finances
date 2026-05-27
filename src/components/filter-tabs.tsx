import Link from 'next/link';
import { cn } from '@/lib/utils';

export type FilterTab = {
    label: string;
    href: string;
    active: boolean;
    count?: number;
};

export function FilterTabs({ tabs }: { tabs: FilterTab[] }) {
    return (
        <nav className="inline-flex h-8 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
            {tabs.map((t) => (
                <Link
                    key={t.href}
                    href={t.href}
                    aria-current={t.active ? 'page' : undefined}
                    className={cn(
                        'inline-flex h-full items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-all',
                        t.active
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-foreground/60 hover:text-foreground',
                    )}
                >
                    {t.label}
                    {typeof t.count === 'number' ? (
                        <span className="text-xs text-muted-foreground">
                            {t.count}
                        </span>
                    ) : null}
                </Link>
            ))}
        </nav>
    );
}
