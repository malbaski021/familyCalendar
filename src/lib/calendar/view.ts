import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';

export const CALENDAR_VIEWS = ['month', 'week', 'day'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const DEFAULT_VIEW: CalendarView = 'month';
// Week starts on Monday — matches the locales the app supports today.
export const WEEK_STARTS_ON = 1 as const;

export interface DateRange {
  start: Date;
  end: Date;
}

export function isCalendarView(value: unknown): value is CalendarView {
  return typeof value === 'string' && (CALENDAR_VIEWS as readonly string[]).includes(value);
}

/** Parse the `view` URL param, falling back to month when missing or invalid. */
export function parseView(value: string | string[] | undefined): CalendarView {
  if (typeof value !== 'string') return DEFAULT_VIEW;
  return isCalendarView(value) ? value : DEFAULT_VIEW;
}

/**
 * Parse the `date` URL param. Accepts ISO `YYYY-MM-DD`; returns today (local
 * midnight) when missing or invalid. Always returns a Date at start-of-day so
 * range math stays predictable.
 */
export function parseDate(value: string | string[] | undefined, today: Date = new Date()): Date {
  if (typeof value !== 'string') return startOfDay(today);
  const parsed = parseISO(value);
  return isValid(parsed) ? startOfDay(parsed) : startOfDay(today);
}

/** Serialise back to the URL — date-only, no time. */
export function formatDateParam(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Visible range for a given view + anchor date.
 *  - month → first Monday of the grid through the last Sunday (so the grid is
 *    always a clean 7-wide block, six rows at most).
 *  - week  → Mon..Sun of the anchor's week.
 *  - day   → just the anchor day.
 */
export function rangeForView(view: CalendarView, anchor: Date): DateRange {
  switch (view) {
    case 'month': {
      const monthStart = startOfMonth(anchor);
      const monthEnd = endOfMonth(anchor);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON }),
      };
    }
    case 'week':
      return {
        start: startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }),
      };
    case 'day':
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
  }
}

/** Step the anchor date forward/backward by one unit of the current view. */
export function stepAnchor(view: CalendarView, anchor: Date, direction: 1 | -1): Date {
  if (direction === 1) {
    if (view === 'month') return addMonths(anchor, 1);
    if (view === 'week') return addWeeks(anchor, 1);
    return addDays(anchor, 1);
  }
  if (view === 'month') return subMonths(anchor, 1);
  if (view === 'week') return subWeeks(anchor, 1);
  return subDays(anchor, 1);
}
