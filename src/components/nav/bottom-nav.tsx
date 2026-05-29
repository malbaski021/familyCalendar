'use client';

import { useTranslations } from 'next-intl';
import { CalendarDaysIcon, PlusCircleIcon, UserCircleIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { key: 'calendar', href: '/calendar', icon: CalendarDaysIcon, labelKey: 'calendar' as const },
  { key: 'add', href: '/calendar/add', icon: PlusCircleIcon, labelKey: 'add' as const },
  { key: 'profile', href: '/profile', icon: UserCircleIcon, labelKey: 'profile' as const },
];

/**
 * Mobile-first bottom dock. Hidden on screens ≥ md so desktops only see the
 * top nav. The "Add" item points at `/calendar/add` which is a placeholder
 * until F6 wires real event creation.
 */
export function BottomNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="bg-background fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t md:hidden"
      data-testid="bottom-nav"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2 text-xs',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
            aria-current={active ? 'page' : undefined}
            data-testid={`bottom-nav-${item.key}-link`}
          >
            <Icon className="h-5 w-5" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
