import { describe, it, expect } from 'vitest';
import { findConflicts, normalizeTitle, type ConflictProbe } from '@/lib/calendar/conflicts';
import type { CalendarEvent } from '@/lib/calendar/occurrences';

function existing(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-existing',
    occurrenceDate: '2026-09-05',
    title: 'Football training',
    category: 'match',
    startDate: '2026-09-05',
    endDate: null,
    startTime: '17:00',
    endTime: '18:30',
    location: null,
    notes: null,
    recurring: false,
    lockedByOther: false,
    children: [],
    ...overrides,
  };
}

function probe(overrides: Partial<ConflictProbe> = {}): ConflictProbe {
  return {
    title: 'Piano lesson',
    startDate: '2026-09-05',
    startTime: '17:30',
    endTime: '18:00',
    allDay: false,
    ...overrides,
  };
}

describe('normalizeTitle', () => {
  it('squashes case, padding and punctuation', () => {
    expect(normalizeTitle('  Luka — FOOTBALL!! ')).toBe('luka football');
  });

  it('folds Serbian diacritics to ASCII', () => {
    expect(normalizeTitle('Čas klavira')).toBe('cas klavira');
    // đ has no canonical decomposition, so stripping combining marks alone
    // would leave nothing behind.
    expect(normalizeTitle('Rođendan')).toBe('rodjendan');
    expect(normalizeTitle('Rodjendan')).toBe('rodjendan');
  });
});

describe('findConflicts — overlaps', () => {
  it('flags two timed events that intersect on the same day', () => {
    const result = findConflicts(probe(), [existing()]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'overlap', eventId: 'evt-existing' });
  });

  it('does not flag back-to-back events', () => {
    // A family with two children books consecutive slots constantly. Warning
    // here would teach the user to ignore the warning.
    const result = findConflicts(
      probe({ startTime: '18:30', endTime: '19:30' }),
      [existing()], // ends 18:30
    );
    expect(result).toEqual([]);
  });

  it('does not flag a different day', () => {
    expect(findConflicts(probe({ startDate: '2026-09-06' }), [existing()])).toEqual([]);
  });

  it('treats an all-day event as clashing with anything that day', () => {
    const result = findConflicts(probe({ allDay: true, startTime: null, endTime: null }), [
      existing(),
    ]);
    expect(result[0]?.kind).toBe('overlap');
  });

  it('treats an existing all-day event the same way', () => {
    // `CalendarEvent` has no all-day flag; a null start time is what marks it.
    const result = findConflicts(probe(), [existing({ startTime: null, endTime: null })]);
    expect(result).toHaveLength(1);
    expect(result[0]?.allDay).toBe(true);
  });

  it('assumes an hour when an event has a start but no end', () => {
    const result = findConflicts(probe({ startTime: '17:30', endTime: null }), [
      existing({ startTime: '18:00', endTime: null }),
    ]);
    expect(result).toHaveLength(1);
  });

  it('checks every day a multi-day event spans', () => {
    const result = findConflicts(
      probe({ startDate: '2026-09-03', endDate: '2026-09-07', allDay: true, startTime: null }),
      [existing({ occurrenceDate: '2026-09-05' })],
    );
    expect(result).toHaveLength(1);
  });
});

describe('findConflicts — duplicates', () => {
  it('flags the same title even when the times do not overlap', () => {
    const result = findConflicts(
      probe({ title: 'football  TRAINING', startTime: '08:00', endTime: '09:00' }),
      [existing()],
    );
    expect(result[0]).toMatchObject({ kind: 'duplicate' });
  });

  it('flags a title that extends the other at a word boundary', () => {
    const result = findConflicts(
      probe({ title: 'Football', startTime: '08:00', endTime: '09:00' }),
      [existing()],
    );
    expect(result[0]?.kind).toBe('duplicate');
  });

  it('does not treat a shared suffix as a duplicate', () => {
    // "match" inside "rematch" is a substring, not a repeat.
    const result = findConflicts(probe({ title: 'match', startTime: '08:00', endTime: '09:00' }), [
      existing({ title: 'rematch' }),
    ]);
    expect(result).toEqual([]);
  });

  it('ranks a duplicate above a mere overlap', () => {
    const result = findConflicts(probe({ title: 'Football training' }), [
      existing({ id: 'evt-overlap', title: 'Dentist' }),
      existing({ id: 'evt-dupe' }),
    ]);
    expect(result.map((c) => c.kind)).toEqual(['duplicate', 'overlap']);
  });
});

describe('findConflicts — exclusions', () => {
  it('does not compare an event being edited against itself', () => {
    expect(
      findConflicts(probe({ title: 'Football training' }), [existing()], 'evt-existing'),
    ).toEqual([]);
  });

  it('reports a recurring series once, not once per occurrence', () => {
    const series = [
      existing({ id: 'evt-weekly', occurrenceDate: '2026-09-05', recurring: true }),
      existing({ id: 'evt-weekly', occurrenceDate: '2026-09-06', recurring: true }),
    ];
    const result = findConflicts(
      probe({ startDate: '2026-09-05', endDate: '2026-09-06', allDay: true, startTime: null }),
      series,
    );
    expect(result).toHaveLength(1);
  });
});
