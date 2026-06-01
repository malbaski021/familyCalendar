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
  let cursor = start;
  // Safety cap so a malformed pattern can't loop indefinitely.
  let iterations = 0;
  while (cursor <= hardLimit && iterations < 5000) {
    if (cursor >= input.rangeStart) dates.push(cursor);
    cursor = step(cursor, input.pattern);
    iterations += 1;
  }
  return dates;
}

function step(date: Date, pattern: RecurrencePattern): Date {
  switch (pattern) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addWeeks(date, 1);
    case 'monthly':
      return addMonths(date, 1);
  }
}
