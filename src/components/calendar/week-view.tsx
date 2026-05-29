'use client';

import { useTranslations } from 'next-intl';
import { addDays, format, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import type { DateRange } from '@/lib/calendar/view';
import type { CalendarEvent } from '@/lib/calendar/query';

interface Props {
  range: DateRange;
  events: CalendarEvent[];
}

const HOURS = Array.from({ length: 24 }).map((_, i) => i);

/**
 * Mon..Sun timeline. Each column is a day; rows are hours. Timed events sit
 * in their hour bucket, all-day events sit above the timeline. Layout is
 * static and CSS-grid driven — no JS-positioned absolute blocks — so
 * accessibility and printing both work for free.
 */
export function WeekView({ range, events }: Props) {
  const t = useTranslations('calendar');

  const days: Date[] = Array.from({ length: 7 }).map((_, i) => addDays(range.start, i));
  const allDayByDay = bucketAllDay(events, days);
  const timedByCell = bucketTimed(events, days);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b">
          <div />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn('border-l p-2 text-center text-xs', isToday(day) && 'bg-accent/40')}
            >
              <div className="text-muted-foreground tracking-wide uppercase">
                {format(day, 'EEE')}
              </div>
              <div className="text-base font-semibold">{day.getDate()}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b">
          <div className="text-muted-foreground p-1 text-right text-[10px] uppercase">
            {t('allDay')}
          </div>
          {days.map((day) => {
            const items = allDayByDay.get(format(day, 'yyyy-MM-dd')) ?? [];
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[2rem] space-y-0.5 border-l p-1',
                  isToday(day) && 'bg-accent/20',
                )}
              >
                {items.map((e) => {
                  const style = CATEGORY_STYLES[e.category];
                  return (
                    <div
                      key={e.id}
                      className={cn('truncate rounded-sm border px-1 text-[10px]', style.chipClass)}
                      data-testid={`calendar-week-event-${e.id}`}
                    >
                      {style.emoji} {e.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
          {HOURS.map((hour) => (
            <HourRow key={hour} hour={hour} days={days} timedByCell={timedByCell} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface HourRowProps {
  hour: number;
  days: Date[];
  timedByCell: Map<string, CalendarEvent[]>;
}

function HourRow({ hour, days, timedByCell }: HourRowProps) {
  return (
    <>
      <div className="text-muted-foreground border-t pt-1 pr-1 text-right text-[10px]">
        {String(hour).padStart(2, '0')}:00
      </div>
      {days.map((day) => {
        const key = `${format(day, 'yyyy-MM-dd')}-${hour}`;
        const items = timedByCell.get(key) ?? [];
        return (
          <div
            key={key}
            className={cn(
              'min-h-[2.5rem] space-y-0.5 border-t border-l p-0.5',
              isToday(day) && 'bg-accent/10',
            )}
          >
            {items.map((e) => {
              const style = CATEGORY_STYLES[e.category];
              return (
                <div
                  key={e.id}
                  className={cn('truncate rounded-sm border px-1 text-[10px]', style.chipClass)}
                  data-testid={`calendar-week-event-${e.id}`}
                >
                  {e.startTime} {e.title}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function bucketAllDay(events: CalendarEvent[], days: Date[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const day of days) map.set(format(day, 'yyyy-MM-dd'), []);
  for (const event of events) {
    if (event.startTime) continue;
    const start = parseISO(event.startDate);
    const end = event.endDate ? parseISO(event.endDate) : start;
    for (const day of days) {
      if (day >= start && day <= end) {
        const list = map.get(format(day, 'yyyy-MM-dd'));
        if (list) list.push(event);
      }
    }
  }
  return map;
}

function bucketTimed(events: CalendarEvent[], days: Date[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!event.startTime) continue;
    const start = parseISO(event.startDate);
    for (const day of days) {
      if (day.toDateString() !== start.toDateString()) continue;
      const hour = Number(event.startTime.split(':')[0]);
      const key = `${format(day, 'yyyy-MM-dd')}-${hour}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
  }
  return map;
}
