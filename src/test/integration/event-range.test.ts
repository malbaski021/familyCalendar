import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { buildRangeFilter } from '@/lib/calendar/occurrences';
import type { Database } from '@/types/database';

// Verifies the SQL semantics of the calendar range predicate against real
// Postgres. `buildRangeFilter` is imported from production code on purpose —
// if someone "simplifies" the filter, this test fails rather than drifting.
//
// Unit coverage for the surrounding fan-out logic lives in
// src/lib/calendar/occurrences.test.ts; only the predicate needs a database.

const url = process.env.SUPABASE_LOCAL_URL!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const JOVIC_FAMILY_ID = '44444444-4444-4444-4444-444444444444';
const JOVIC_TATA_ID = '22222222-2222-2222-2222-222222222222';

// A far-future window so the seeded fixtures can't influence the result.
const RANGE_START = '2031-06-01';
const RANGE_END = '2031-06-30';

interface Fixture {
  key: string;
  start_date: string;
  end_date?: string | null;
  recurring_pattern?: 'daily' | 'weekly' | 'monthly' | null;
  /** Whether the production predicate should return this row. */
  expected: boolean;
  why: string;
}

const FIXTURES: Fixture[] = [
  {
    key: 'single-inside',
    start_date: '2031-06-15',
    expected: true,
    why: 'single-day inside the range — matches the NULL end_date branch',
  },
  {
    key: 'single-before',
    start_date: '2031-05-01',
    expected: false,
    why: 'single-day before the range — the lower bound must exclude it',
  },
  {
    key: 'multiday-straddles-start',
    start_date: '2031-05-28',
    end_date: '2031-06-03',
    expected: true,
    why: 'multi-day crossing the range start — must stay visible',
  },
  {
    key: 'multiday-entirely-before',
    start_date: '2031-04-01',
    end_date: '2031-04-10',
    expected: false,
    why: 'multi-day ending before the range — excluded',
  },
  {
    key: 'recurring-starts-long-before',
    start_date: '2031-01-05',
    recurring_pattern: 'weekly',
    expected: true,
    why: 'recurring master row predating the range must never be bounded out',
  },
  {
    key: 'single-after',
    start_date: '2031-07-15',
    expected: false,
    why: 'starts after the range — excluded by the upper bound',
  },
];

const idsByKey = new Map<string, string>();

describe('calendar range predicate against Postgres', () => {
  beforeAll(async () => {
    const rows = FIXTURES.map((f) => ({
      family_id: JOVIC_FAMILY_ID,
      created_by: JOVIC_TATA_ID,
      title: `range-fixture-${f.key}`,
      category: 'other' as const,
      start_date: f.start_date,
      end_date: f.end_date ?? null,
      recurring_pattern: f.recurring_pattern ?? null,
    }));

    const { data, error } = await admin.from('events').insert(rows).select('id, title');
    expect(error).toBeNull();
    for (const row of data ?? []) {
      idsByKey.set(row.title.replace('range-fixture-', ''), row.id);
    }
    expect(idsByKey.size).toBe(FIXTURES.length);
  });

  afterAll(async () => {
    const ids = [...idsByKey.values()];
    if (ids.length > 0) await admin.from('events').delete().in('id', ids);
  });

  /** Runs the exact shape of the production query, scoped to the fixtures. */
  async function runRangeQuery(filter: string): Promise<Set<string>> {
    const { data, error } = await admin
      .from('events')
      .select('id, title')
      .eq('family_id', JOVIC_FAMILY_ID)
      .in('id', [...idsByKey.values()])
      .lte('start_date', RANGE_END)
      .or(filter);
    expect(error).toBeNull();
    return new Set((data ?? []).map((r) => r.title.replace('range-fixture-', '')));
  }

  it('returns exactly the rows that overlap the range', async () => {
    const got = await runRangeQuery(buildRangeFilter(RANGE_START));
    const expected = FIXTURES.filter((f) => f.expected).map((f) => f.key);
    expect([...got].sort()).toEqual([...expected].sort());
  });

  it.each(FIXTURES)('$key → returned=$expected ($why)', async ({ key, expected }) => {
    const got = await runRangeQuery(buildRangeFilter(RANGE_START));
    expect(got.has(key)).toBe(expected);
  });

  it('drops single-day events if the NULL end_date branch is removed', async () => {
    // Documents why the third disjunct exists: `NULL >= 'x'` evaluates to NULL,
    // not false, so an end_date comparison alone silently loses every
    // single-day event. If this ever stops being true, the filter can be
    // simplified — until then, do not.
    const naive = `recurring_pattern.not.is.null,end_date.gte.${RANGE_START}`;
    const got = await runRangeQuery(naive);

    expect(got.has('single-inside')).toBe(false);
    // The rows that don't depend on that branch are unaffected.
    expect(got.has('multiday-straddles-start')).toBe(true);
    expect(got.has('recurring-starts-long-before')).toBe(true);
  });
});
