import Link from 'next/link';
import { Fragment } from 'react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export type BreadcrumbBarItem = {
    label: string;
    href?: string;
};

export function BreadcrumbBar({ items }: { items: BreadcrumbBarItem[] }) {
    if (items.length === 0) return null;
    return (
        <Breadcrumb>
            <BreadcrumbList>
                {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    return (
                        <Fragment key={`${item.label}-${idx}`}>
                            <BreadcrumbItem>
                                {isLast || !item.href ? (
                                    <BreadcrumbPage>
                                        {item.label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink
                                        render={<Link href={item.href} />}
                                    >
                                        {item.label}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {isLast ? null : <BreadcrumbSeparator />}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
