'use client';

import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { ClockIcon, MapPinIcon } from 'lucide-react';
import { EventDialog } from '@/components/calendar/event-dialog';
import { cn } from '@/lib/utils';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import type { CalendarEvent } from '@/lib/calendar/query';

interface Props {
  anchor: Date;
  events: CalendarEvent[];
}

/**
 * Single-day detail. Events are split into all-day (top band) and timed
 * (sorted ascending by start_time). Empty state covers the common
 * placeholder case (no events on the chosen day).
 */
export function DayView({ anchor, events }: Props) {
  const t = useTranslations('calendar');
  const dayKey = format(anchor, 'yyyy-MM-dd');

  const dayEvents = events.filter((e) => {
    // Recurring occurrences land on a single date; non-recurring multi-day
    // events span between their start and end.
    if (e.recurring) return e.occurrenceDate === dayKey;
    const start = parseISO(e.startDate);
    const end = e.endDate ? parseISO(e.endDate) : start;
    return anchor >= start && anchor <= end;
  });

  const allDay = dayEvents.filter((e) => !e.startTime);
  const timed = dayEvents
    .filter((e) => e.startTime)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  if (dayEvents.length === 0) {
    return (
      <div
        className="text-muted-foreground flex flex-col items-center gap-2 p-12 text-sm"
        data-testid="calendar-day-empty"
      >
        <p>{t('empty.day')}</p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4"
      data-testid={`calendar-day-${dayKey}`}
    >
      {allDay.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-muted-foreground text-xs tracking-wide uppercase">{t('allDay')}</h2>
          {allDay.map((e) => (
            <EventRow key={`${e.id}-${e.occurrenceDate}`} event={e} />
          ))}
        </section>
      )}
      {timed.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
            {t('scheduled')}
          </h2>
          {timed.map((e) => (
            <EventRow key={`${e.id}-${e.occurrenceDate}`} event={e} />
          ))}
        </section>
      )}
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const style = CATEGORY_STYLES[event.category];
  return (
    <EventDialog
      event={event}
      className={cn('flex w-full gap-3 rounded-lg border p-3 hover:brightness-95', style.chipClass)}
      testId={`calendar-day-event-${event.id}-${event.occurrenceDate}-link`}
    >
      <div className="text-2xl" aria-hidden="true">
        {style.emoji}
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-sm font-semibold">{event.title}</h3>
        {(event.startTime || event.location) && (
          <p className="flex flex-wrap items-center gap-3 text-xs">
            {event.startTime && (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                {event.startTime}
                {event.endTime && ` — ${event.endTime}`}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3 w-3" />
                {event.location}
              </span>
            )}
          </p>
        )}
        {event.notes && <p className="text-xs">{event.notes}</p>}
      </div>
    </EventDialog>
  );
}
