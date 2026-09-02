import 'server-only';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  assembleOccurrences,
  buildRangeFilter,
  type CalendarEvent,
  type EventRangeRow,
  type InstanceOverrideRow,
} from '@/lib/calendar/occurrences';
import type { DateRange } from '@/lib/calendar/view';

// Re-exported so existing component imports keep working. The definitions live
// in `occurrences.ts`, which is free of `server-only` and therefore testable.
export type { CalendarEvent, EventCategory } from '@/lib/calendar/occurrences';

const EVENT_COLUMNS =
  'id, title, category, start_date, end_date, start_time, end_time, location, notes, recurring_pattern, recurring_end_date, locked_by, locked_at, event_children(child_id, children(name))';

const INSTANCE_COLUMNS =
  'event_id, instance_date, is_cancelled, override_title, override_start_time, override_end_time, override_location, override_notes';

/**
 * Pull every event belonging to the family that overlaps the visible range and
 * hand the rows to `assembleOccurrences` for fan-out, overrides and sorting.
 *
 * This function is the DB shell only — all range/occurrence logic lives in
 * `occurrences.ts` so it can be unit tested without a database, and the
 * `buildRangeFilter` predicate is asserted against real Postgres in
 * `src/test/integration/event-range.test.ts`.
 */
export async function loadEventsInRange(
  familyId: string,
  range: DateRange,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const startStr = format(range.start, 'yyyy-MM-dd');
  const endStr = format(range.end, 'yyyy-MM-dd');

  const currentUser = await getCurrentUser();
  const callerId = currentUser?.authId ?? null;

  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('family_id', familyId)
    .lte('start_date', endStr)
    .or(buildRangeFilter(startStr));
  if (error || !data) return [];

  const rows = data as EventRangeRow[];
  const eventIds = rows.map((e) => e.id);

  const { data: instances } = eventIds.length
    ? await supabase
        .from('event_instances')
        .select(INSTANCE_COLUMNS)
        .in('event_id', eventIds)
        .gte('instance_date', startStr)
        .lte('instance_date', endStr)
    : { data: [] };

  return assembleOccurrences({
    rows,
    instances: (instances ?? []) as InstanceOverrideRow[],
    range,
    callerId,
  });
}
