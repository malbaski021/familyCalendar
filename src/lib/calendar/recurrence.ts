import { addDays, addMonths, addWeeks, isBefore, parseISO } from 'date-fns';
import type { Database } from '@/types/database';

export type RecurrencePattern = Database['public']['Enums']['recurring_pattern'];

/**
 * Given a master event's start date and pattern, return every occurrence date
 * that falls inside [rangeStart, rangeEnd], clamped by the optional series
 * `endDate`. Open-ended series are expanded only as far as the range — they
 * never balloon into infinity.
 *
 * Pure function, no DB access. Caller is responsible for filtering out
 * cancelled instances later.
 */
export function expandOccurrences(input: {
  startDate: string;
  pattern: RecurrencePattern | null;
  endDate: string | null;
  rangeStart: Date;
  rangeEnd: Date;
}): Date[] {
  const start = parseISO(input.startDate);
  // Non-recurring event: single occurrence on the start_date.
  if (!input.pattern) {
    if (start >= input.rangeStart && start <= input.rangeEnd) return [start];
    return [];
  }

  const seriesEnd = input.endDate ? parseISO(input.endDate) : input.rangeEnd;
  const hardLimit = isBefore(seriesEnd, input.rangeEnd) ? seriesEnd : input.rangeEnd;

  const dates: Date[] = [];
  // Safety cap so a malformed pattern can't loop indefinitely.
  let n = 0;
  let cursor = start;
  while (cursor <= hardLimit && n < 5000) {
    if (cursor >= input.rangeStart) dates.push(cursor);
    n += 1;
    cursor = occurrenceAt(start, input.pattern, n);
  }
  return dates;
}

/**
 * The n-th occurrence of a series, always computed from the ORIGINAL start
 * date rather than by stepping off the previous occurrence.
 *
 * This matters for `monthly`: `addMonths` clamps to the last valid day of the
 * target month, so a series starting Jan 31 steps to Feb 28 — and stepping
 * again from Feb 28 would yield Mar 28, permanently losing the 31st. Anchoring
 * to `start` keeps the intended day-of-month and only clamps in short months
 * (Jan 31 → Feb 28 → Mar 31 → Apr 30 → May 31).
 */
function occurrenceAt(start: Date, pattern: RecurrencePattern, n: number): Date {
  switch (pattern) {
    case 'daily':
      return addDays(start, n);
    case 'weekly':
      return addWeeks(start, n);
    case 'monthly':
      return addMonths(start, n);
  }
}
