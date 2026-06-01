import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_LOCAL_URL!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const JOVIC_FAMILY_ID = '44444444-4444-4444-4444-444444444444';
const JOVIC_TATA_ID = '22222222-2222-2222-2222-222222222222';

function ts() {
  return Date.now().toString(36);
}

describe('recurring events', () => {
  const eventIds: string[] = [];

  afterAll(async () => {
    if (eventIds.length > 0) await admin.from('events').delete().in('id', eventIds);
  });

  it('creates a weekly recurring event with optional series end date', async () => {
    const { data, error } = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-weekly-${ts()}`,
        category: 'match',
        start_date: '2026-07-01',
        start_time: '17:00',
        end_time: '18:00',
        recurring_pattern: 'weekly',
        recurring_end_date: '2026-09-01',
        created_by: JOVIC_TATA_ID,
      })
      .select('id, recurring_pattern, recurring_end_date')
      .single();
    expect(error).toBeNull();
    expect(data?.recurring_pattern).toBe('weekly');
    expect(data?.recurring_end_date).toBe('2026-09-01');
    if (data?.id) eventIds.push(data.id);
  });

  it('cancels a single occurrence without touching the series row', async () => {
    const event = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-cancel-occ-${ts()}`,
        category: 'school',
        start_date: '2026-07-06',
        recurring_pattern: 'weekly',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    expect(event.error).toBeNull();
    const eventId = event.data!.id;
    eventIds.push(eventId);

    const { error: cancelErr } = await admin
      .from('event_instances')
      .upsert(
        { event_id: eventId, instance_date: '2026-07-13', is_cancelled: true },
        { onConflict: 'event_id,instance_date' },
      );
    expect(cancelErr).toBeNull();

    // Master event is still intact.
    const { data: master } = await admin
      .from('events')
      .select('recurring_pattern')
      .eq('id', eventId)
      .single();
    expect(master?.recurring_pattern).toBe('weekly');

    const { data: instance } = await admin
      .from('event_instances')
      .select('is_cancelled, override_title')
      .eq('event_id', eventId)
      .eq('instance_date', '2026-07-13')
      .single();
    expect(instance?.is_cancelled).toBe(true);
    expect(instance?.override_title).toBeNull();
  });

  it('overrides one occurrence with new title and time, leaves others alone', async () => {
    const event = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-override-${ts()}`,
        category: 'other',
        start_date: '2026-08-01',
        start_time: '10:00',
        end_time: '11:00',
        recurring_pattern: 'weekly',
        created_by: JOVIC_TATA_ID,
      })
      .select('id, title')
      .single();
    expect(event.error).toBeNull();
    const eventId = event.data!.id;
    eventIds.push(eventId);
    const originalTitle = event.data!.title;

    const { error: overrideErr } = await admin.from('event_instances').upsert(
      {
        event_id: eventId,
        instance_date: '2026-08-15',
        is_cancelled: false,
        override_title: 'one-off rename',
        override_start_time: '14:00',
      },
      { onConflict: 'event_id,instance_date' },
    );
    expect(overrideErr).toBeNull();

    const { data: instance } = await admin
      .from('event_instances')
      .select('override_title, override_start_time, is_cancelled')
      .eq('event_id', eventId)
      .eq('instance_date', '2026-08-15')
      .single();
    expect(instance?.override_title).toBe('one-off rename');
    expect(instance?.override_start_time).toBe('14:00:00');
    expect(instance?.is_cancelled).toBe(false);

    // Master title untouched — other occurrences inherit it.
    const { data: master } = await admin
      .from('events')
      .select('title, start_time')
      .eq('id', eventId)
      .single();
    expect(master?.title).toBe(originalTitle);
    expect(master?.start_time).toBe('10:00:00');
  });

  it('event_instances rows cascade when the master event is deleted', async () => {
    const event = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-cascade-${ts()}`,
        category: 'other',
        start_date: '2026-09-01',
        recurring_pattern: 'daily',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    expect(event.error).toBeNull();
    const eventId = event.data!.id;

    await admin.from('event_instances').insert({
      event_id: eventId,
      instance_date: '2026-09-05',
      is_cancelled: true,
    });

    const { error: delErr } = await admin.from('events').delete().eq('id', eventId);
    expect(delErr).toBeNull();

    const { data: orphans } = await admin
      .from('event_instances')
      .select('event_id')
      .eq('event_id', eventId);
    expect(orphans).toEqual([]);
  });
});
