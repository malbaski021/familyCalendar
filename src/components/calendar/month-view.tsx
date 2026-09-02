'use client';

import { useTranslations } from 'next-intl';
import { addDays, format, isSameMonth, isToday, parseISO } from 'date-fns';
import { Link } from '@/i18n/navigation';
import { EventDialog } from '@/components/calendar/event-dialog';
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
 * Six-row max month grid. The day-number link jumps to the day view; each
 * event chip is its own link to the event detail. Cells themselves are
 * `<div>`s so we never nest interactive elements.
 */
export function MonthView({ range, anchor, events }: Props) {
  const t = useTranslations('calendar');

  const days: Date[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);

  const eventsByDay = bucketEventsByDay(events, days);

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
          <div
            key={dayKey}
            className={cn(
              'min-h-[80px] border-r border-b p-1.5 text-xs last:border-r-0',
              !inMonth && 'bg-muted/40 text-muted-foreground',
              isToday(day) && 'bg-accent/40',
            )}
            data-testid={`calendar-month-day-${dayKey}-cell`}
          >
            <Link
              href={`/calendar?view=day&date=${formatDateParam(day)}`}
              aria-label={t('openDay', { date: format(day, 'PP') })}
              className={cn(
                'hover:bg-accent inline-block min-w-[1.5rem] rounded-full px-1 text-center text-xs font-medium',
                isToday(day) && 'bg-primary text-primary-foreground hover:bg-primary',
              )}
              data-testid={`calendar-month-day-${dayKey}-link`}
            >
              {day.getDate()}
            </Link>
            <div className="mt-1 space-y-0.5">
              {dayEvents.slice(0, 3).map((e) => {
                const style = CATEGORY_STYLES[e.category];
                return (
                  <EventDialog
                    key={`${e.id}-${e.occurrenceDate}`}
                    event={e}
                    className={cn(
                      'flex w-full items-center gap-1 truncate rounded-sm border px-1 hover:brightness-95',
                      style.chipClass,
                    )}
                    testId={`calendar-month-event-${e.id}-${e.occurrenceDate}-link`}
                  >
                    {e.lockedByOther && <span aria-label="locked">🔒</span>}
                    <span aria-hidden="true">{style.emoji}</span>
                    <span className="truncate">{e.title}</span>
                  </EventDialog>
                );
              })}
              {dayEvents.length > 3 && (
                <div className="text-muted-foreground text-[10px]">+{dayEvents.length - 3}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function weekdayLabels(start: Date): string[] {
  return Array.from({ length: 7 }).map((_, i) => format(addDays(start, i), 'EEE'));
}

function bucketEventsByDay(events: CalendarEvent[], days: Date[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const day of days) map.set(format(day, 'yyyy-MM-dd'), []);

  for (const event of events) {
    if (event.recurring) {
      // Recurring occurrences are single-day by definition — drop them in the
      // bucket matching their occurrenceDate.
      const list = map.get(event.occurrenceDate);
      if (list) list.push(event);
      continue;
    }
    // Non-recurring: still need to span multi-day events across each day they cover.
    const start = parseISO(event.startDate);
    const end = event.endDate ? parseISO(event.endDate) : start;
    for (const day of days) {
      if (day >= start && day <= end) {
        const key = format(day, 'yyyy-MM-dd');
        const list = map.get(key);
        if (list) list.push(event);
      }
    }
  }
  return map;
}
