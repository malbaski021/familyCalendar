'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, ClockIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import type { CalendarEvent } from '@/lib/calendar/query';

interface Props {
  event: CalendarEvent;
  /** Chip styling supplied by the view — each view sizes its chips differently. */
  className?: string;
  testId: string;
  children: React.ReactNode;
}

/** Detail page for this occurrence; recurring events carry the date. */
export function eventDetailHref(event: CalendarEvent): string {
  return event.recurring
    ? `/calendar/${event.id}?date=${event.occurrenceDate}`
    : `/calendar/${event.id}`;
}

/**
 * Wraps an event chip so clicking it opens a modal instead of navigating.
 *
 * The trigger is a `<button>`, not a link: the previous `<Link>` meant every
 * click cost a full page load just to read a title and a time. The detail
 * page is still reachable from the modal, so deep links and the edit / delete
 * / per-occurrence flows keep working unchanged.
 */
export function EventDialog({ event, className, testId, children }: Props) {
  const t = useTranslations('events');
  const [open, setOpen] = useState(false);

  const style = CATEGORY_STYLES[event.category];
  const detailHref = eventDetailHref(event);
  const editHref = event.recurring
    ? `/calendar/${event.id}/instance/${event.occurrenceDate}/edit`
    : `/calendar/${event.id}/edit`;

  const occurrence = parseISO(event.occurrenceDate);
  const multiDay = !!event.endDate && event.endDate !== event.startDate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={cn('text-left', className)} data-testid={testId}>
          {children}
        </button>
      </DialogTrigger>

      <DialogContent data-testid={`event-dialog-${event.id}-${event.occurrenceDate}`}>
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <span aria-hidden="true">{style.emoji}</span>
            <span>{event.title}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-sm border px-1.5 py-0.5 text-xs', style.chipClass)}>
              {t(`categories.${event.category}`)}
            </span>
            {event.recurring && (
              <span className="text-muted-foreground text-xs">{t('seriesBadge')}</span>
            )}
            {event.lockedByOther && (
              <span className="text-muted-foreground text-xs">🔒 {t('lock.lockedFallback')}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
            <dd>
              {format(occurrence, 'EEEE, d MMMM yyyy')}
              {/* A multi-day range only makes sense for one-off events; a
                  recurring occurrence is a single day by definition. */}
              {multiDay && !event.recurring && event.endDate && (
                <> — {format(parseISO(event.endDate), 'EEEE, d MMMM yyyy')}</>
              )}
            </dd>
          </div>

          <div className="flex items-center gap-2">
            <ClockIcon className="text-muted-foreground size-4 shrink-0" />
            <dd>
              {event.startTime ? (
                <>
                  {event.startTime}
                  {event.endTime && ` — ${event.endTime}`}
                </>
              ) : (
                t('form.allDay')
              )}
            </dd>
          </div>

          {event.location && (
            <div className="flex items-center gap-2">
              <MapPinIcon className="text-muted-foreground size-4 shrink-0" />
              <dd>{event.location}</dd>
            </div>
          )}

          {event.children.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <UsersIcon className="text-muted-foreground size-4 shrink-0" />
              <dd className="flex flex-wrap gap-1">
                {event.children.map((child) => (
                  <span
                    key={child.id}
                    className="bg-muted rounded-full px-2 py-0.5 text-xs"
                    data-testid={`event-dialog-${event.id}-child-${child.id}`}
                  >
                    {child.name}
                  </span>
                ))}
              </dd>
            </div>
          )}

          {event.notes && (
            <div className="mt-1">
              <dt className="text-muted-foreground text-xs">{t('form.notes')}</dt>
              <dd className="whitespace-pre-wrap">{event.notes}</dd>
            </div>
          )}
        </dl>

        <DialogFooter>
          <Button variant="outline" asChild>
            <Link
              href={detailHref}
              onClick={() => setOpen(false)}
              data-testid={`event-dialog-${event.id}-open-link`}
            >
              {t('dialog.openFull')}
            </Link>
          </Button>
          <Button asChild>
            <Link
              href={editHref}
              onClick={() => setOpen(false)}
              data-testid={`event-dialog-${event.id}-edit-link`}
            >
              {t('edit')}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
