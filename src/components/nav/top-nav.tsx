'use client';

import { useTranslations } from 'next-intl';
import { CalendarDaysIcon, PlusCircleIcon, UserCircleIcon, SettingsIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoutButton } from '@/components/auth/logout-button';

const ITEMS = [
  { key: 'calendar', href: '/calendar', icon: CalendarDaysIcon, labelKey: 'calendar' as const },
  { key: 'add', href: '/calendar/add', icon: PlusCircleIcon, labelKey: 'add' as const },
  { key: 'settings', href: '/settings', icon: SettingsIcon, labelKey: 'settings' as const },
  { key: 'profile', href: '/profile', icon: UserCircleIcon, labelKey: 'profile' as const },
];

/**
 * Desktop horizontal nav, shown ≥ md. Mirrors the bottom-nav items plus
 * Settings and the existing theme / language / logout controls.
 */
export function TopNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <header
      className="bg-background sticky top-0 z-30 hidden border-b md:flex"
      data-testid="top-nav"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-2">
        <nav aria-label="Primary" className="flex items-center gap-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
                data-testid={`top-nav-${item.key}-link`}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
