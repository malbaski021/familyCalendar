import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  duplicateWindow,
  loadDuplicateCandidates,
  loadSuggestionInput,
  trimTime,
} from '@/lib/ai/candidates';
import { MAX_DUPLICATE_CANDIDATES } from '@/lib/ai/constants';
import type { Database } from '@/types/database';

// The candidate query is what keeps the prompt inside the free-tier
// tokens-per-minute ceiling, so its window and cap are asserted against real
// Postgres. The Supabase client is injected — production uses the RLS-bound
// session client, which needs a Next request context this harness has not got.

const admin = createClient<Database>(
  process.env.SUPABASE_LOCAL_URL!,
  process.env.SUPABASE_LOCAL_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const JOVIC_FAMILY_ID = '44444444-4444-4444-4444-444444444444';
const JOVIC_TATA_ID = '22222222-2222-2222-2222-222222222222';
const ANCHOR = '2032-04-15';

const createdEventIds: string[] = [];

async function makeEvent(title: string, startDate: string, startTime?: string): Promise<string> {
  const { data, error } = await admin
    .from('events')
    .insert({
      family_id: JOVIC_FAMILY_ID,
      created_by: JOVIC_TATA_ID,
      title,
      category: 'other',
      start_date: startDate,
      start_time: startTime ?? null,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  createdEventIds.push(data!.id);
  return data!.id;
}

// File-level cleanup: the later describe creates rows after the earlier one
// would have finished, so a per-describe afterAll would leave them behind.
afterAll(async () => {
  if (createdEventIds.length) await admin.from('events').delete().in('id', createdEventIds);
});

describe('duplicateWindow / trimTime', () => {
  it('spans three days either side', () => {
    expect(duplicateWindow('2032-04-15')).toEqual({ from: '2032-04-12', to: '2032-04-18' });
  });

  it('rolls across a month boundary', () => {
    expect(duplicateWindow('2032-05-02')).toEqual({ from: '2032-04-29', to: '2032-05-05' });
  });

  it('rolls across a year boundary', () => {
    expect(duplicateWindow('2032-01-01')).toEqual({ from: '2031-12-29', to: '2032-01-04' });
  });

  it('trims seconds off a time and passes null through', () => {
    expect(trimTime('09:30:00')).toBe('09:30');
    expect(trimTime(null)).toBeNull();
  });
});

describe('loadDuplicateCandidates against Postgres', () => {
  let selfId: string;

  beforeAll(async () => {
    selfId = await makeEvent('cand-self', ANCHOR, '10:00:00');
    await makeEvent('cand-minus-5', '2032-04-10');
    await makeEvent('cand-minus-3', '2032-04-12');
    await makeEvent('cand-minus-1', '2032-04-14', '18:45:00');
    await makeEvent('cand-plus-1', '2032-04-16');
    await makeEvent('cand-plus-3', '2032-04-18');
    await makeEvent('cand-plus-5', '2032-04-20');
  });

  it('returns only events inside the window, excluding the event itself', async () => {
    const candidates = await loadDuplicateCandidates(
      { familyId: JOVIC_FAMILY_ID, startDate: ANCHOR, excludeEventId: selfId },
      admin,
    );
    const titles = candidates.map((c) => c.title).sort();

    expect(titles).toEqual(['cand-minus-1', 'cand-minus-3', 'cand-plus-1', 'cand-plus-3']);
    // ±5 days is outside the window; the anchor event must not match itself.
    expect(titles).not.toContain('cand-minus-5');
    expect(titles).not.toContain('cand-plus-5');
    expect(candidates.map((c) => c.id)).not.toContain(selfId);
  });

  it('includes the event itself when no exclusion is given', async () => {
    const candidates = await loadDuplicateCandidates(
      { familyId: JOVIC_FAMILY_ID, startDate: ANCHOR },
      admin,
    );
    expect(candidates.map((c) => c.id)).toContain(selfId);
  });

  it('trims times and keeps all-day events as null', async () => {
    const candidates = await loadDuplicateCandidates(
      { familyId: JOVIC_FAMILY_ID, startDate: ANCHOR, excludeEventId: selfId },
      admin,
    );
    expect(candidates.find((c) => c.title === 'cand-minus-1')?.time).toBe('18:45');
    expect(candidates.find((c) => c.title === 'cand-plus-1')?.time).toBeNull();
  });

  it('caps the row count even when the window is crowded', async () => {
    // Twelve more events all on the anchor day — well past the cap.
    for (let i = 0; i < 12; i += 1) await makeEvent(`cand-crowd-${i}`, ANCHOR);

    const candidates = await loadDuplicateCandidates(
      { familyId: JOVIC_FAMILY_ID, startDate: ANCHOR },
      admin,
    );
    expect(candidates).toHaveLength(MAX_DUPLICATE_CANDIDATES);
  });

  it('never leaks another family’s events', async () => {
    const { data: other } = await admin
      .from('families')
      .select('id')
      .neq('id', JOVIC_FAMILY_ID)
      .limit(1)
      .maybeSingle();

    if (!other) return; // seed has a second family, but don't fail if it changes

    const candidates = await loadDuplicateCandidates(
      { familyId: other.id, startDate: ANCHOR },
      admin,
    );
    expect(candidates.map((c) => c.id).filter((id) => createdEventIds.includes(id))).toEqual([]);
  });
});

describe('loadSuggestionInput against Postgres', () => {
  let eventId: string;

  beforeAll(async () => {
    eventId = await makeEvent('suggestion-input-target', '2032-06-10', '17:15:00');
    await makeEvent('suggestion-input-neighbour', '2032-06-11');
  });

  it('assembles the event, the family children and the candidates', async () => {
    const input = await loadSuggestionInput(
      { eventId, familyId: JOVIC_FAMILY_ID, locale: 'sr-Latn' },
      admin,
    );

    expect(input).not.toBeNull();
    expect(input!.title).toBe('suggestion-input-target');
    expect(input!.startTime).toBe('17:15');
    expect(input!.locale).toBe('sr-Latn');
    // Seeded family has children; the agents need their ids to tag directly.
    expect(input!.children.length).toBeGreaterThan(0);
    expect(input!.children[0]).toHaveProperty('id');
    expect(input!.children[0]).toHaveProperty('name');
    expect(input!.candidates.map((c) => c.title)).toContain('suggestion-input-neighbour');
    expect(input!.candidates.map((c) => c.id)).not.toContain(eventId);
  });

  it('returns null for an event in a different family', async () => {
    const { data: other } = await admin
      .from('families')
      .select('id')
      .neq('id', JOVIC_FAMILY_ID)
      .limit(1)
      .maybeSingle();
    if (!other) return;

    const input = await loadSuggestionInput({ eventId, familyId: other.id, locale: 'en' }, admin);
    expect(input).toBeNull();
  });

  it('returns null for an unknown event id', async () => {
    const input = await loadSuggestionInput(
      {
        eventId: '00000000-0000-0000-0000-000000000000',
        familyId: JOVIC_FAMILY_ID,
        locale: 'en',
      },
      admin,
    );
    expect(input).toBeNull();
  });
});
