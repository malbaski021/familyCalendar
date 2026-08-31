import { describe, it, expect } from 'vitest';
import {
  assembleOccurrences,
  buildRangeFilter,
  type EventRangeRow,
  type InstanceOverrideRow,
} from './occurrences';

const JUNE = { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) };

function event(overrides: Partial<EventRangeRow> = {}): EventRangeRow {
  return {
    id: 'evt-1',
    title: 'Training',
    category: 'other',
    start_date: '2026-06-10',
    end_date: null,
    start_time: null,
    end_time: null,
    location: null,
    notes: null,
    recurring_pattern: null,
    recurring_end_date: null,
    locked_by: null,
    locked_at: null,
    ...overrides,
  };
}

function instance(overrides: Partial<InstanceOverrideRow> = {}): InstanceOverrideRow {
  return {
    event_id: 'evt-1',
    instance_date: '2026-06-10',
    is_cancelled: false,
    override_title: null,
    override_start_time: null,
    override_end_time: null,
    override_location: null,
    override_notes: null,
    ...overrides,
  };
}

function assemble(input: {
  rows: EventRangeRow[];
  instances?: InstanceOverrideRow[];
  callerId?: string | null;
  now?: number;
}) {
  return assembleOccurrences({
    rows: input.rows,
    instances: input.instances ?? [],
    range: JUNE,
    callerId: input.callerId ?? 'me',
    now: input.now,
  });
}

describe('buildRangeFilter', () => {
  it('emits the three disjuncts PostgREST needs, in order', () => {
    expect(buildRangeFilter('2026-06-01')).toBe(
      'recurring_pattern.not.is.null,' +
        'end_date.gte.2026-06-01,' +
        'and(end_date.is.null,start_date.gte.2026-06-01)',
    );
  });

  it('keeps the NULL end_date branch separate from the end_date comparison', () => {
    // `NULL >= 'x'` is NULL rather than false in SQL, so single-day events
    // would silently vanish if this branch were folded into disjunct 2.
    const filter = buildRangeFilter('2026-06-01');
    expect(filter).toContain('and(end_date.is.null,start_date.gte.2026-06-01)');
  });
});

describe('assembleOccurrences — non-recurring', () => {
  it('keeps a single-day event inside the range', () => {
    const result = assemble({ rows: [event()] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ occurrenceDate: '2026-06-10', recurring: false });
  });

  it('drops an event that ends before the range starts', () => {
    expect(assemble({ rows: [event({ start_date: '2026-05-01' })] })).toHaveLength(0);
  });

  it('drops an event that starts after the range ends', () => {
    expect(assemble({ rows: [event({ start_date: '2026-07-05' })] })).toHaveLength(0);
  });

  it('keeps a multi-day event straddling the range start', () => {
    const rows = [event({ start_date: '2026-05-28', end_date: '2026-06-03' })];
    const result = assemble({ rows });
    expect(result).toHaveLength(1);
    // occurrenceDate stays the real start, even though it precedes the range.
    expect(result[0].occurrenceDate).toBe('2026-05-28');
  });

  it('truncates times to HH:MM', () => {
    const rows = [event({ start_time: '09:30:00', end_time: '11:00:00' })];
    const result = assemble({ rows });
    expect(result[0].startTime).toBe('09:30');
    expect(result[0].endTime).toBe('11:00');
  });

  it('ignores instance overrides for non-recurring events', () => {
    const rows = [event()];
    const instances = [instance({ override_title: 'Should not apply' })];
    expect(assemble({ rows, instances })[0].title).toBe('Training');
  });
});

describe('assembleOccurrences — recurring', () => {
  it('fans a weekly series out across the range', () => {
    const rows = [event({ start_date: '2026-06-01', recurring_pattern: 'weekly' })];
    const result = assemble({ rows });
    expect(result.map((e) => e.occurrenceDate)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
      '2026-06-22',
      '2026-06-29',
    ]);
    expect(result.every((e) => e.recurring)).toBe(true);
    expect(new Set(result.map((e) => e.id)).size).toBe(1);
  });

  it('applies a per-instance override to only that occurrence', () => {
    const rows = [event({ start_date: '2026-06-01', recurring_pattern: 'weekly' })];
    const instances = [
      instance({
        instance_date: '2026-06-15',
        override_title: 'Moved indoors',
        override_start_time: '18:45:00',
      }),
    ];
    const result = assemble({ rows, instances });
    const overridden = result.find((e) => e.occurrenceDate === '2026-06-15');
    expect(overridden).toMatchObject({ title: 'Moved indoors', startTime: '18:45' });
    expect(result.filter((e) => e.title === 'Training')).toHaveLength(4);
  });

  it('skips a cancelled occurrence but keeps the rest of the series', () => {
    const rows = [event({ start_date: '2026-06-01', recurring_pattern: 'weekly' })];
    const instances = [instance({ instance_date: '2026-06-15', is_cancelled: true })];
    const result = assemble({ rows, instances });
    expect(result.map((e) => e.occurrenceDate)).not.toContain('2026-06-15');
    expect(result).toHaveLength(4);
  });

  it('clips the series at recurring_end_date', () => {
    const rows = [
      event({
        start_date: '2026-06-01',
        recurring_pattern: 'weekly',
        recurring_end_date: '2026-06-16',
      }),
    ];
    expect(assemble({ rows })).toHaveLength(3);
  });

  it('does not drift a monthly series anchored on the 31st', () => {
    const rows = [event({ id: 'monthly', start_date: '2026-01-31', recurring_pattern: 'monthly' })];
    const result = assembleOccurrences({
      rows,
      instances: [],
      range: { start: new Date(2026, 0, 1), end: new Date(2026, 4, 31) },
      callerId: 'me',
    });
    expect(result.map((e) => e.occurrenceDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });
});

describe('assembleOccurrences — lock badge', () => {
  const now = new Date('2026-06-10T12:00:00Z').getTime();
  const fresh = new Date('2026-06-10T11:55:00Z').toISOString();
  const stale = new Date('2026-06-10T11:30:00Z').toISOString();

  it('flags a fresh lock held by somebody else', () => {
    const rows = [event({ locked_by: 'partner', locked_at: fresh })];
    expect(assemble({ rows, now }).at(0)?.lockedByOther).toBe(true);
  });

  it('does not flag the caller holding their own lock', () => {
    const rows = [event({ locked_by: 'me', locked_at: fresh })];
    expect(assemble({ rows, now }).at(0)?.lockedByOther).toBe(false);
  });

  it('does not flag a lock older than the TTL', () => {
    const rows = [event({ locked_by: 'partner', locked_at: stale })];
    expect(assemble({ rows, now }).at(0)?.lockedByOther).toBe(false);
  });

  it('does not flag a locked_by with no locked_at', () => {
    const rows = [event({ locked_by: 'partner', locked_at: null })];
    expect(assemble({ rows, now }).at(0)?.lockedByOther).toBe(false);
  });

  it('treats an anonymous caller as not holding any lock', () => {
    const rows = [event({ locked_by: 'partner', locked_at: fresh })];
    expect(assemble({ rows, callerId: null, now }).at(0)?.lockedByOther).toBe(true);
  });
});

describe('assembleOccurrences — ordering', () => {
  it('sorts by date, then all-day before timed, then by start time', () => {
    const rows = [
      event({ id: 'c', start_date: '2026-06-11', start_time: '08:00:00' }),
      event({ id: 'b', start_date: '2026-06-10', start_time: '14:00:00' }),
      event({ id: 'a', start_date: '2026-06-10', start_time: null }),
      event({ id: 'd', start_date: '2026-06-10', start_time: '09:15:00' }),
    ];
    expect(assemble({ rows }).map((e) => e.id)).toEqual(['a', 'd', 'b', 'c']);
  });
});
