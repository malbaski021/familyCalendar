'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from '@/i18n/navigation';
import {
  CALENDAR_VIEWS,
  formatDateParam,
  stepAnchor,
  type CalendarView,
} from '@/lib/calendar/view';

interface Props {
  view: CalendarView;
  anchor: Date;
  title: string;
}

/**
 * The top of every calendar page. Owns the prev/next stepper, the
 * view-switcher (Month / Week / Day), the "today" jump, and the title.
 * State lives in the URL — every action navigates so reload + share work
 * out of the box.
 */
export function CalendarNav({ view, anchor, title }: Props) {
  const t = useTranslations('calendar');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function navigate(nextView: CalendarView, nextAnchor: Date) {
    const params = new URLSearchParams();
    params.set('view', nextView);
    params.set('date', formatDateParam(nextAnchor));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(view, stepAnchor(view, anchor, -1))}
          disabled={isPending}
          aria-label={t('prev')}
          data-testid="calendar-nav-prev-button"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(view, stepAnchor(view, anchor, 1))}
          disabled={isPending}
          aria-label={t('next')}
          data-testid="calendar-nav-next-button"
        >
          <ChevronRightIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(view, new Date())}
          disabled={isPending}
          data-testid="calendar-nav-today-button"
        >
          <CalendarIcon />
          {t('today')}
        </Button>
        <h1 className="ml-2 text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
      </div>
      <div className="flex items-center gap-1" role="tablist" aria-label={t('viewSwitcher')}>
        {CALENDAR_VIEWS.map((v) => (
          <Button
            key={v}
            type="button"
            variant={view === v ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigate(v, anchor)}
            disabled={isPending}
            aria-pressed={view === v}
            data-testid={`calendar-nav-view-${v}-button`}
          >
            {t(`views.${v}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
