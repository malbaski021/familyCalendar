'use client';

import { useTranslations } from 'next-intl';
import { addDays, format, isSameMonth, isToday } from 'date-fns';
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
 * Six-row max month grid. The day-number link jumps to the day view.
 *
 * Each event is a coloured category dot plus its start time — full titles do
 * not fit a phone-width cell, and a row of dots reads as "how busy is this
 * day" at a glance. A bare dot with no time means an all-day event. Cells
 * themselves are `<div>`s so we never nest interactive elements.
 */

/** Rows that fit a cell before the overflow marker takes over. */
const MAX_VISIBLE_PER_DAY = 4;
export function MonthView({ range, anchor, events }: Props) {
  const t = useTranslations('calendar');

  const days: Date[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);

  const eventsByDay = bucketEventsByDay(events, days);

  // 4, 5 or 6 weeks depending on the month, so the row count comes from the
  // data. Each week row is an equal fraction of the height the parent hands
  // down — no per-cell minimum, no leftover gap above the dock.
  const weeks = Math.max(1, Math.round(days.length / 7));

  return (
    <div
      className="grid h-full grid-cols-7 border-b"
      style={{ gridTemplateRows: `auto repeat(${weeks}, minmax(0, 1fr))` }}
    >
      {weekdayLabels(range.start).map((label) => (
        <div
          key={label}
          className="bg-muted/70 text-muted-foreground border-r border-b px-2 py-2 text-center text-[11px] font-semibold tracking-wider uppercase last:border-r-0"
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
              'relative overflow-hidden border-r border-b p-1.5 text-xs last:border-r-0',
              // Days spilling in from the neighbouring months are context, not
              // content — pushed well back so the current month reads as the
              // subject of the grid.
              !inMonth && 'bg-muted text-muted-foreground/50',
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
            <ul className="mt-1 space-y-0.5">
              {dayEvents.slice(0, MAX_VISIBLE_PER_DAY).map((e) => {
                const style = CATEGORY_STYLES[e.category];
                return (
                  <li key={`${e.id}-${e.occurrenceDate}`}>
                    <EventDialog
                      event={e}
                      className="hover:bg-accent flex w-full items-center gap-1.5 rounded-sm px-0.5"
                      testId={`calendar-month-event-${e.id}-${e.occurrenceDate}-link`}
                    >
                      <span
                        className={cn('size-1.5 shrink-0 rounded-full', style.dotClass)}
                        aria-hidden="true"
                      />
                      {e.lockedByOther && <span aria-label="locked">🔒</span>}
                      {/* No time means all-day — the bare dot carries that. */}
                      {e.startTime && (
                        <span className="truncate text-[10px] tabular-nums">{e.startTime}</span>
                      )}
                    </EventDialog>
                  </li>
                );
              })}
            </ul>
            {dayEvents.length > MAX_VISIBLE_PER_DAY && (
              <span
                className="text-muted-foreground absolute right-1 bottom-1 text-[10px] font-medium"
                data-testid={`calendar-month-day-${dayKey}-overflow`}
              >
                +{dayEvents.length - MAX_VISIBLE_PER_DAY}
              </span>
            )}
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
    // Non-recurring: still need to span multi-day events across each day they
    // cover. Compared as `yyyy-MM-dd` strings rather than Date objects — the
    // `days` come from a server-serialised range while `parseISO` would run
    // again in the browser's timezone, and the two disagree by the UTC offset.
    // See the matching comment in `day-view.tsx`.
    const end = event.endDate ?? event.startDate;
    for (const key of map.keys()) {
      if (event.startDate <= key && key <= end) {
        map.get(key)!.push(event);
      }
    }
  }
  return map;
}
