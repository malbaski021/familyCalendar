// Pure calendar-range logic, deliberately free of `server-only` and of any
// Supabase client import so it can be exercised from both the jsdom unit suite
// and the Node integration suite. `query.ts` is the thin DB shell around this.

import { format } from 'date-fns';
import { LOCK_TTL_MS } from '@/lib/calendar/lock-constants';
import { expandOccurrences, type RecurrencePattern } from '@/lib/calendar/recurrence';
import type { DateRange } from '@/lib/calendar/view';
import type { Database } from '@/types/database';

export type EventCategory = Database['public']['Enums']['event_category'];

export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD of THIS specific occurrence. For non-recurring single events it
   *  equals `startDate`. For recurring series, every fan-out gets a different
   *  value here while sharing `id`. The detail page reads this from the URL. */
  occurrenceDate: string;
  title: string;
  category: EventCategory;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  recurring: boolean;
  /** True when ANOTHER family member currently holds the (non-stale) edit lock.
   *  The chip renders a small badge so users see "someone is editing this" before
   *  they try to open it. Self-locks aren't surfaced — they're the boring case. */
  lockedByOther: boolean;
  /** Tagged children. Attached to the master event, so every occurrence of a
   *  recurring series shares the same list. */
  children: TaggedChild[];
}

export interface TaggedChild {
  id: string;
  name: string;
}

/** The `events` columns the calendar range query selects. */
export interface EventRangeRow {
  id: string;
  title: string;
  category: EventCategory;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  recurring_pattern: RecurrencePattern | null;
  recurring_end_date: string | null;
  locked_by: string | null;
  locked_at: string | null;
  /** Embedded join rows. Optional so fixtures don't have to supply them. */
  event_children?: { child_id: string; children: { name: string } | { name: string }[] | null }[];
}

/** The `event_instances` columns the calendar range query selects. */
export interface InstanceOverrideRow {
  event_id: string;
  instance_date: string;
  is_cancelled: boolean;
  override_title: string | null;
  override_start_time: string | null;
  override_end_time: string | null;
  override_location: string | null;
  override_notes: string | null;
}

/**
 * PostgREST `or=` predicate that puts a LOWER bound on the range query. Without
 * it, rendering a single month drags the family's entire event history over the
 * wire and filters it in JS.
 *
 * Three disjuncts, and each one is load-bearing:
 *   1. recurring series must stay unbounded — the master row's `start_date` can
 *      predate the range by years and still produce occurrences inside it;
 *   2. non-recurring rows WITH an `end_date` overlap when they end at or after
 *      the range start (this is what keeps multi-day events that straddle the
 *      boundary visible);
 *   3. non-recurring rows WITHOUT an `end_date` are single-day, so `start_date`
 *      decides. Needed as its own branch because `NULL >= 'x'` evaluates to
 *      NULL — not true — so disjunct 2 silently drops those rows.
 *
 * Exported so the integration suite can assert the predicate against real
 * Postgres using the exact string production uses.
 */
export function buildRangeFilter(rangeStartStr: string): string {
  return [
    'recurring_pattern.not.is.null',
    `end_date.gte.${rangeStartStr}`,
    `and(end_date.is.null,start_date.gte.${rangeStartStr})`,
  ].join(',');
}

/**
 * Fan recurring series out into individual occurrences, apply per-instance
 * overrides, drop cancelled instances, and sort the result.
 *
 * Returned `CalendarEvent`s share the same `id` for every occurrence of the
 * same series — callers identify an instance by the `(id, occurrenceDate)` pair.
 */
export function assembleOccurrences(input: {
  rows: EventRangeRow[];
  instances: InstanceOverrideRow[];
  range: DateRange;
  /** Auth id of the caller, so self-held locks aren't flagged. */
  callerId: string | null;
  /** Injectable clock, so lock-staleness tests don't depend on wall time. */
  now?: number;
}): CalendarEvent[] {
  const { rows, instances, range, callerId } = input;
  const now = input.now ?? Date.now();
  const startStr = format(range.start, 'yyyy-MM-dd');
  const endStr = format(range.end, 'yyyy-MM-dd');

  const overridesByKey = new Map<string, InstanceOverrideRow>();
  for (const row of instances) {
    overridesByKey.set(`${row.event_id}|${row.instance_date}`, row);
  }

  function lockedByOther(event: EventRangeRow): boolean {
    if (!event.locked_by || event.locked_by === callerId) return false;
    if (!event.locked_at) return false;
    return now - new Date(event.locked_at).getTime() <= LOCK_TTL_MS;
  }

  const occurrences: CalendarEvent[] = [];
  for (const event of rows) {
    const isRecurring = event.recurring_pattern !== null;
    const locked = lockedByOther(event);

    // Non-recurring single-or-multi-day path: emit a single CalendarEvent
    // unless the row falls entirely outside the range.
    if (!isRecurring) {
      const start = event.start_date;
      const end = event.end_date ?? event.start_date;
      if (end < startStr || start > endStr) continue;
      occurrences.push(makeOccurrence(event, event.start_date, false, null, locked));
      continue;
    }

    // Recurring: expand and apply overrides per occurrence.
    const dates = expandOccurrences({
      startDate: event.start_date,
      pattern: event.recurring_pattern as RecurrencePattern,
      endDate: event.recurring_end_date,
      rangeStart: range.start,
      rangeEnd: range.end,
    });

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const override = overridesByKey.get(`${event.id}|${dateStr}`);
      if (override?.is_cancelled) continue;
      occurrences.push(makeOccurrence(event, dateStr, true, override ?? null, locked));
    }
  }

  // Stable sort: by occurrenceDate, then start_time (nulls first / all-day first).
  occurrences.sort((a, b) => {
    if (a.occurrenceDate !== b.occurrenceDate) {
      return a.occurrenceDate < b.occurrenceDate ? -1 : 1;
    }
    const aT = a.startTime ?? '';
    const bT = b.startTime ?? '';
    return aT < bT ? -1 : aT > bT ? 1 : 0;
  });

  return occurrences;
}

function makeOccurrence(
  event: EventRangeRow,
  occurrenceDate: string,
  recurring: boolean,
  override: InstanceOverrideRow | null,
  lockedByOther: boolean,
): CalendarEvent {
  return {
    id: event.id,
    occurrenceDate,
    title: override?.override_title ?? event.title,
    category: event.category,
    startDate: event.start_date,
    endDate: event.end_date,
    startTime: pickTime(override?.override_start_time ?? event.start_time),
    endTime: pickTime(override?.override_end_time ?? event.end_time),
    location: override?.override_location ?? event.location,
    notes: override?.override_notes ?? event.notes,
    recurring,
    lockedByOther,
    children: taggedChildren(event),
  };
}

function taggedChildren(event: EventRangeRow): TaggedChild[] {
  return (event.event_children ?? [])
    .map((row) => {
      // PostgREST types an embedded to-one relation as possibly an array.
      const child = Array.isArray(row.children) ? row.children[0] : row.children;
      return { id: row.child_id, name: child?.name ?? '' };
    })
    .filter((c) => c.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function pickTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length >= 5 ? value.slice(0, 5) : value;
}
