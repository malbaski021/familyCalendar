import { describe, it, expect } from 'vitest';
import { expandOccurrences } from './recurrence';

describe('expandOccurrences', () => {
  it('non-recurring event yields a single date if inside the range', () => {
    const dates = expandOccurrences({
      startDate: '2026-06-15',
      pattern: null,
      endDate: null,
      rangeStart: new Date(2026, 5, 1),
      rangeEnd: new Date(2026, 5, 30),
    });
    expect(dates).toHaveLength(1);
  });

  it('non-recurring event outside the range yields nothing', () => {
    const dates = expandOccurrences({
      startDate: '2026-01-15',
      pattern: null,
      endDate: null,
      rangeStart: new Date(2026, 5, 1),
      rangeEnd: new Date(2026, 5, 30),
    });
    expect(dates).toHaveLength(0);
  });

  it('weekly series within a month expands to four occurrences', () => {
    const dates = expandOccurrences({
      startDate: '2026-06-01', // Monday
      pattern: 'weekly',
      endDate: null,
      rangeStart: new Date(2026, 5, 1),
      rangeEnd: new Date(2026, 5, 30),
    });
    expect(dates.map((d) => d.getDate())).toEqual([1, 8, 15, 22, 29]);
  });

  it('daily series is clipped by the explicit endDate', () => {
    const dates = expandOccurrences({
      startDate: '2026-06-01',
      pattern: 'daily',
      endDate: '2026-06-05',
      rangeStart: new Date(2026, 5, 1),
      rangeEnd: new Date(2026, 5, 30),
    });
    expect(dates).toHaveLength(5);
  });

  it('monthly series across half a year', () => {
    const dates = expandOccurrences({
      startDate: '2026-01-15',
      pattern: 'monthly',
      endDate: null,
      rangeStart: new Date(2026, 0, 1),
      rangeEnd: new Date(2026, 5, 30),
    });
    expect(dates.map((d) => d.getMonth())).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('series whose start is before the range still produces in-range occurrences only', () => {
    const dates = expandOccurrences({
      startDate: '2025-12-15',
      pattern: 'weekly',
      endDate: null,
      rangeStart: new Date(2026, 0, 5),
      rangeEnd: new Date(2026, 0, 31),
    });
    // 2025-12-15, 22, 29 → out. 2026-01-05, 12, 19, 26 → in.
    expect(dates).toHaveLength(4);
  });
});
