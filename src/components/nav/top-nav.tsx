'use client';

import { useTranslations } from 'next-intl';
import {
  CalendarDaysIcon,
  PlusCircleIcon,
  UserCircleIcon,
  SettingsIcon,
  ShieldCheckIcon,
  HistoryIcon,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoutButton } from '@/components/auth/logout-button';

const BASE_ITEMS = [
  { key: 'calendar', href: '/calendar', icon: CalendarDaysIcon, labelKey: 'calendar' as const },
  { key: 'add', href: '/calendar/add', icon: PlusCircleIcon, labelKey: 'add' as const },
  { key: 'settings', href: '/settings', icon: SettingsIcon, labelKey: 'settings' as const },
  { key: 'profile', href: '/profile', icon: UserCircleIcon, labelKey: 'profile' as const },
];

// Super-admin only. Activity sits here rather than in BASE_ITEMS because the
// audit log is an operator tool: a family member has no use for it, and the
// page itself now refuses non-admins.
const ADMIN_ITEMS = [
  { key: 'audit', href: '/audit', icon: HistoryIcon, labelKey: 'audit' as const },
  { key: 'admin', href: '/admin', icon: ShieldCheckIcon, labelKey: 'admin' as const },
];

interface Props {
  /** Show the Admin entry when the rendering user is the super-admin. */
  isAdmin?: boolean;
}

/**
 * Desktop horizontal nav, shown ≥ md. Mirrors the bottom-nav items plus
 * Settings and the existing theme / language / logout controls. Activity and
 * Admin are appended only for the super-admin (`user.profile.role === 'admin'`).
 */
export function TopNav({ isAdmin = false }: Props) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const items = isAdmin ? [...BASE_ITEMS, ...ADMIN_ITEMS] : BASE_ITEMS;

  return (
    <header
      className="bg-background sticky top-0 z-30 hidden border-b md:flex"
      data-testid="top-nav"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-2">
        <nav aria-label="Primary" className="flex items-center gap-1">
          {items.map((item) => {
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
