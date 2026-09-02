import 'server-only';
import { addDays, format, parseISO } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { DUPLICATE_WINDOW_DAYS, MAX_DUPLICATE_CANDIDATES } from '@/lib/ai/constants';
import type { AiDuplicateCandidate, AiSuggestionInput } from '@/lib/ai/schemas';
import type { Database } from '@/types/database';

// Assembles everything the agents need for one event. The duplicate candidates
// are narrowed in SQL rather than by asking the model to scan the calendar:
// on Groq's free tier the binding limit is tokens-per-minute, and the candidate
// list is by far the largest part of the prompt.

type Db = SupabaseClient<Database>;

/**
 * The ±N day range searched for duplicates. Exported so tests can assert the
 * boundary arithmetic (month and year rollovers) without a database.
 */
export function duplicateWindow(startDate: string): { from: string; to: string } {
  const anchor = parseISO(startDate);
  return {
    from: format(addDays(anchor, -DUPLICATE_WINDOW_DAYS), 'yyyy-MM-dd'),
    to: format(addDays(anchor, DUPLICATE_WINDOW_DAYS), 'yyyy-MM-dd'),
  };
}

/** Seconds carry no signal for duplicate detection and cost tokens. */
export function trimTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

/**
 * Existing events near `startDate` that could plausibly be the same thing.
 *
 * Bounded twice on purpose — the window in SQL, then a hard cap on rows. The
 * window means a weekly series contributes at most its neighbouring
 * occurrence, so a busy family cannot blow the token budget.
 *
 * `db` is injectable so integration tests can exercise this against real
 * Postgres; production passes nothing and gets the RLS-bound session client.
 */
export async function loadDuplicateCandidates(
  params: {
    familyId: string;
    startDate: string;
    /** Excluded from its own candidate list. */
    excludeEventId?: string;
  },
  db?: Db,
): Promise<AiDuplicateCandidate[]> {
  const supabase = db ?? (await createServerClient());
  const { from, to } = duplicateWindow(params.startDate);

  let query = supabase
    .from('events')
    .select('id, title, start_date, start_time')
    .eq('family_id', params.familyId)
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date', { ascending: true })
    .limit(MAX_DUPLICATE_CANDIDATES);

  if (params.excludeEventId) query = query.neq('id', params.excludeEventId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.start_date,
    time: trimTime(row.start_time),
  }));
}

/**
 * Build the agents' input for an already-saved event. Returns null when the
 * event does not exist or is not in the given family — the caller treats that
 * as "no suggestions" rather than an error.
 */
export async function loadSuggestionInput(
  params: {
    eventId: string;
    familyId: string;
    locale: string;
  },
  db?: Db,
): Promise<AiSuggestionInput | null> {
  const supabase = db ?? (await createServerClient());

  const { data: event } = await supabase
    .from('events')
    .select('id, title, category, start_date, start_time, location, notes')
    .eq('id', params.eventId)
    .eq('family_id', params.familyId)
    .maybeSingle();
  if (!event) return null;

  const { data: children } = await supabase
    .from('children')
    .select('id, name')
    .eq('family_id', params.familyId)
    .order('created_at', { ascending: true });

  const candidates = await loadDuplicateCandidates(
    {
      familyId: params.familyId,
      startDate: event.start_date,
      excludeEventId: event.id,
    },
    supabase,
  );

  return {
    title: event.title,
    category: event.category,
    startDate: event.start_date,
    startTime: trimTime(event.start_time),
    location: event.location,
    notes: event.notes,
    children: (children ?? []).map((c) => ({ id: c.id, name: c.name })),
    candidates,
    locale: params.locale,
  };
}
