'use client';

import { useTranslations } from 'next-intl';
import { CalendarDaysIcon, PlusCircleIcon, UserCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const BASE_ITEMS = [
  { key: 'calendar', href: '/calendar', icon: CalendarDaysIcon, labelKey: 'calendar' as const },
  { key: 'add', href: '/calendar/add', icon: PlusCircleIcon, labelKey: 'add' as const },
  { key: 'profile', href: '/profile', icon: UserCircleIcon, labelKey: 'profile' as const },
];

const ADMIN_ITEM = {
  key: 'admin',
  href: '/admin',
  icon: ShieldCheckIcon,
  labelKey: 'admin' as const,
};

interface Props {
  /** Show the Admin entry when the rendering user is the super-admin. */
  isAdmin?: boolean;
}

/**
 * Mobile-first bottom dock. Hidden on screens ≥ md so desktops only see the
 * top nav. The "Add" item points at `/calendar/add` which is a placeholder
 * until F6 wires real event creation. The Admin entry is appended only for
 * the super-admin so the regular grid stays 3-wide.
 */
export function BottomNav({ isAdmin = false }: Props) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const items = isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
  const gridCols = isAdmin ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <nav
      aria-label="Primary"
      className={cn(
        // Not `fixed`. The shell is a full-height flex column whose <main>
        // owns the scrolling, so the dock stays on screen simply by being the
        // last child — and the column then measures it, instead of the shell
        // reserving a guessed height and leaving a sliver of dead space when
        // the guess ran long.
        'bg-background grid shrink-0 border-t md:hidden',
        // The home indicator occupies the very bottom of a modern iPhone, so
        // the row needs padding below it or the icons sit in the gesture area.
        // The extra 1rem is a deliberate lift; `env()` is 0 without one.
        'pb-[calc(env(safe-area-inset-bottom)+1rem)]',
        gridCols,
      )}
      data-testid="bottom-nav"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2.5 text-xs',
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
