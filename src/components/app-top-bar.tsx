import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AppShellUserMenu } from '@/components/app-shell-user-menu';

export function AppTopBar({
    email,
    children,
}: {
    email: string;
    children?: React.ReactNode;
}) {
    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <Separator
                orientation="vertical"
                className="mr-1 data-[orientation=vertical]:h-5"
            />
            <div className="min-w-0 flex-1">{children}</div>
            <AppShellUserMenu email={email} />
        </header>
    );
}
