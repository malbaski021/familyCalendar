import 'server-only';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { DateRange } from '@/lib/calendar/view';

export type EventCategory = Database['public']['Enums']['event_category'];

export interface CalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  startTime: string | null; // HH:mm
  endTime: string | null;
  location: string | null;
  notes: string | null;
}

/**
 * Pull every event belonging to the given family that overlaps the visible
 * range. Recurring expansion is F7's job; for F5 we only show base events.
 *
 * The overlap test handles multi-day events: an event with
 * start_date ≤ range.end AND (end_date ≥ range.start OR end_date IS NULL
 * AND start_date ≥ range.start) is in.
 */
export async function loadEventsInRange(
  familyId: string,
  range: DateRange,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const startStr = format(range.start, 'yyyy-MM-dd');
  const endStr = format(range.end, 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('events')
    .select('id, title, category, start_date, end_date, start_time, end_time, location, notes')
    .eq('family_id', familyId)
    .lte('start_date', endStr)
    .or(`end_date.gte.${startStr},and(end_date.is.null,start_date.gte.${startStr})`)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time ? row.start_time.slice(0, 5) : null,
    endTime: row.end_time ? row.end_time.slice(0, 5) : null,
    location: row.location,
    notes: row.notes,
  }));
}
