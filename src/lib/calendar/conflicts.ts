// Pre-save clash detection.
//
// This runs before the event is written, so it deliberately does NOT use the
// AI. Two reasons: `ai_queue.event_id` is NOT NULL, so a pre-save call has no
// queue to fall back on when Groq is slow — and a family should never wait on
// a third party to find out that they already have football at 17:00. The
// checks here are arithmetic on dates and times: instant, free, and identical
// every time. The AI duplicate agent still runs after the save, where it adds
// the semantic judgement this cannot make ("trening" vs "practice").

import type { CalendarEvent } from '@/lib/calendar/occurrences';

export type ConflictKind = 'duplicate' | 'overlap';

export interface EventConflict {
  kind: ConflictKind;
  eventId: string;
  occurrenceDate: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
}

/** The shape the form can supply before an event exists. */
export interface ConflictProbe {
  title: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  allDay: boolean;
}

/**
 * Titles are compared on a squashed form so casing, padding, punctuation and
 * Serbian diacritics do not hide an obvious repeat. "Luka — FOOTBALL!" and
 * "luka fudbal" still differ (different words), but "Luka Football" and
 * "luka  football" collapse to the same key.
 */
export function normalizeTitle(title: string): string {
  return (
    title
      // Đ/đ is its own letter, not a decorated D — NFD leaves it intact and the
      // ASCII filter below would eat it, turning "Đorđe" into "or e". Same fix
      // as `slugify`.
      .replace(/[Đđ]/g, 'dj')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  );
}

function sameTitle(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // "Football" vs "Football training" — one is a prefix of the other at a word
  // boundary. Substring matching alone would pair "match" with "rematch".
  return left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

/** Inclusive date-span intersection; ISO dates compare correctly as strings. */
function datesIntersect(probe: ConflictProbe, occurrenceDate: string): boolean {
  const end = probe.endDate ?? probe.startDate;
  return probe.startDate <= occurrenceDate && occurrenceDate <= end;
}

function minutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Half-open intervals: an event ending at 17:00 does not clash with one
 * starting at 17:00. Back-to-back activities are the normal case for a family
 * with more than one child, and warning about them would train the user to
 * ignore the warning.
 */
function timesOverlap(probe: ConflictProbe, other: CalendarEvent): boolean {
  // `CalendarEvent` has no all-day flag — a null `startTime` IS all-day, and
  // either way a missing time makes the event effectively day-wide.
  if (probe.allDay || !probe.startTime || !other.startTime) return true;

  const aStart = minutes(probe.startTime);
  const aEnd = probe.endTime ? minutes(probe.endTime) : aStart + 60;
  const bStart = minutes(other.startTime);
  const bEnd = other.endTime ? minutes(other.endTime) : bStart + 60;

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Find existing events the probe would clash with.
 *
 * `excludeEventId` keeps an edit from flagging the event against itself — and
 * against its own other occurrences, which are the same series.
 */
export function findConflicts(
  probe: ConflictProbe,
  existing: CalendarEvent[],
  excludeEventId?: string,
): EventConflict[] {
  const conflicts: EventConflict[] = [];
  const seen = new Set<string>();

  for (const other of existing) {
    if (other.id === excludeEventId) continue;
    if (!datesIntersect(probe, other.occurrenceDate)) continue;

    const duplicate = sameTitle(probe.title, other.title);
    if (!duplicate && !timesOverlap(probe, other)) continue;

    // One row per event: a weekly series inside a multi-day span would
    // otherwise report the same title several times over.
    if (seen.has(other.id)) continue;
    seen.add(other.id);

    conflicts.push({
      kind: duplicate ? 'duplicate' : 'overlap',
      eventId: other.id,
      occurrenceDate: other.occurrenceDate,
      title: other.title,
      startTime: other.startTime,
      endTime: other.endTime,
      allDay: other.startTime === null,
    });
  }

  // A same-named event is the stronger signal, so it leads.
  return conflicts.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'duplicate' ? -1 : 1;
    return a.occurrenceDate.localeCompare(b.occurrenceDate);
  });
}
