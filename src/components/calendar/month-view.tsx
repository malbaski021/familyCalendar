'use client';

import { useTranslations } from 'next-intl';
import { addDays, format, isSameDay, isSameMonth, isToday, parseISO } from 'date-fns';
import { useRouter, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import { formatDateParam, type DateRange } from '@/lib/calendar/view';
import type { CalendarEvent } from '@/lib/calendar/query';

interface Props {
  range: DateRange;
  anchor: Date;
  events: CalendarEvent[];
}

/**
 * Six-row max month grid. Tapping a day on mobile switches the URL to the
 * day view; on desktop the row stays put — the day-cell content is visible
 * enough already.
 */
export function MonthView({ range, anchor, events }: Props) {
  const t = useTranslations('calendar');
  const router = useRouter();
  const pathname = usePathname();

  const days: Date[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);

  const eventsByDay = bucketEventsByDay(events, days);

  function goToDay(d: Date) {
    const params = new URLSearchParams();
    params.set('view', 'day');
    params.set('date', formatDateParam(d));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-7 border-b">
      {weekdayLabels(range.start).map((label) => (
        <div
          key={label}
          className="text-muted-foreground border-r border-b px-2 py-2 text-center text-xs font-medium tracking-wide uppercase last:border-r-0"
        >
          {label}
        </div>
      ))}
      {days.map((day) => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay.get(dayKey) ?? [];
        const inMonth = isSameMonth(day, anchor);
        return (
          <button
            type="button"
            key={dayKey}
            onClick={() => goToDay(day)}
            className={cn(
              'min-h-[80px] border-r border-b p-1.5 text-left text-xs last:border-r-0',
              !inMonth && 'bg-muted/40 text-muted-foreground',
              isToday(day) && 'bg-accent/40',
            )}
            data-testid={`calendar-month-day-${dayKey}-cell`}
            aria-label={t('openDay', { date: format(day, 'PP') })}
          >
            <span
              className={cn(
                'inline-block min-w-[1.5rem] rounded-full px-1 text-center text-xs font-medium',
                isToday(day) && 'bg-primary text-primary-foreground',
              )}
            >
              {day.getDate()}
            </span>
            <div className="mt-1 space-y-0.5">
              {dayEvents.slice(0, 3).map((e) => {
                const style = CATEGORY_STYLES[e.category];
                return (
                  <div
                    key={e.id}
                    className={cn(
                      'flex items-center gap-1 truncate rounded-sm border px-1',
                      style.chipClass,
                    )}
                    data-testid={`calendar-month-event-${e.id}`}
                  >
                    <span aria-hidden="true">{style.emoji}</span>
                    <span className="truncate">{e.title}</span>
                  </div>
                );
              })}
              {dayEvents.length > 3 && (
                <div className="text-muted-foreground text-[10px]">+{dayEvents.length - 3}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function weekdayLabels(start: Date): string[] {
  return Array.from({ length: 7 }).map((_, i) => format(addDays(start, i), 'EEE'));
}

/** Group events by the visible day they fall on, expanding multi-day spans. */
function bucketEventsByDay(events: CalendarEvent[], days: Date[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const day of days) map.set(format(day, 'yyyy-MM-dd'), []);

  for (const event of events) {
    const start = parseISO(event.startDate);
    const end = event.endDate ? parseISO(event.endDate) : start;
    for (const day of days) {
      if (day >= start && day <= end) {
        const key = format(day, 'yyyy-MM-dd');
        const list = map.get(key);
        if (list) list.push(event);
      }
      // The fact that we matched at least one day in the window already means
      // we don't need to early-exit — most months have ~35 cells, work is cheap.
      // (Keeping the structure readable beats a micro-optimisation.)
      if (isSameDay(day, end)) break;
    }
  }
  return map;
}
