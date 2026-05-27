'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

const LOCALE_LABEL_KEYS: Record<Locale, 'languageEn' | 'languageSrLatn'> = {
  en: 'languageEn',
  'sr-Latn': 'languageSrLatn',
};

export function LanguageToggle() {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const activeLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    if (locale === activeLocale) return;
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('language')}
          disabled={isPending}
          data-testid="nav-language-toggle"
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onSelect={() => switchTo(locale)}
            data-active={locale === activeLocale ? 'true' : undefined}
            data-testid={`nav-language-toggle-option-${locale}`}
          >
            {t(LOCALE_LABEL_KEYS[locale])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
