import 'server-only';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { LOCK_TTL_MS } from '@/lib/calendar/lock-constants';
import type { Database } from '@/types/database';
import type { DateRange } from '@/lib/calendar/view';
import { expandOccurrences, type RecurrencePattern } from '@/lib/calendar/recurrence';

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
}

/**
 * Pull every event belonging to the family that overlaps the visible range,
 * fan out recurring series into individual occurrences, apply per-instance
 * overrides, and drop cancelled instances.
 *
 * Returned `CalendarEvent`s share the same `id` for every occurrence of the
 * same series — callers identify an instance by the `(id, occurrenceDate)` pair.
 */
export async function loadEventsInRange(
  familyId: string,
  range: DateRange,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const startStr = format(range.start, 'yyyy-MM-dd');
  const endStr = format(range.end, 'yyyy-MM-dd');

  // Pull two buckets:
  //  1. one-off / multi-day events that overlap the range (same predicate as F5)
  //  2. recurring series whose start_date is ≤ range.end AND
  //     (recurring_end_date IS NULL OR recurring_end_date ≥ range.start)
  const currentUser = await getCurrentUser();
  const callerId = currentUser?.authId ?? null;

  const { data, error } = await supabase
    .from('events')
    .select(
      'id, title, category, start_date, end_date, start_time, end_time, location, notes, recurring_pattern, recurring_end_date, locked_by, locked_at',
    )
    .eq('family_id', familyId)
    .lte('start_date', endStr);
  if (error || !data) return [];

  const eventIds = data.map((e) => e.id);
  const { data: instances } = eventIds.length
    ? await supabase
        .from('event_instances')
        .select(
          'event_id, instance_date, is_cancelled, override_title, override_start_time, override_end_time, override_location, override_notes',
        )
        .in('event_id', eventIds)
        .gte('instance_date', startStr)
        .lte('instance_date', endStr)
    : { data: [] };

  const overridesByKey = new Map<
    string,
    {
      is_cancelled: boolean;
      override_title: string | null;
      override_start_time: string | null;
      override_end_time: string | null;
      override_location: string | null;
      override_notes: string | null;
    }
  >();
  for (const row of instances ?? []) {
    overridesByKey.set(`${row.event_id}|${row.instance_date}`, row);
  }

  const now = Date.now();
  function lockedByOther(event: { locked_by: string | null; locked_at: string | null }): boolean {
    if (!event.locked_by || event.locked_by === callerId) return false;
    if (!event.locked_at) return false;
    return now - new Date(event.locked_at).getTime() <= LOCK_TTL_MS;
  }

  const occurrences: CalendarEvent[] = [];
  for (const event of data) {
    const isRecurring = event.recurring_pattern !== null;
    const locked = lockedByOther(event);

    // Non-recurring single-or-multi-day path: keep the F5 behaviour and emit
    // a single CalendarEvent unless the row falls entirely outside the range.
    if (!isRecurring) {
      const start = event.start_date;
      const end = event.end_date ?? event.start_date;
      // Same predicate the SQL would have applied; cheaper than another round-trip.
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
  event: {
    id: string;
    title: string;
    category: EventCategory;
    start_date: string;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    notes: string | null;
  },
  occurrenceDate: string,
  recurring: boolean,
  override: {
    override_title: string | null;
    override_start_time: string | null;
    override_end_time: string | null;
    override_location: string | null;
    override_notes: string | null;
  } | null,
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
  };
}

function pickTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length >= 5 ? value.slice(0, 5) : value;
}
