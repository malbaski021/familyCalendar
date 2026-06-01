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
const LUKA_CHILD_ID = '55555555-5555-5555-5555-555555555551';

function ts() {
  return Date.now().toString(36);
}

describe('events CRUD against seeded family', () => {
  const eventIds: string[] = [];

  afterAll(async () => {
    if (eventIds.length > 0) await admin.from('events').delete().in('id', eventIds);
  });

  it('creates a single-day timed event', async () => {
    const { data, error } = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-event-${ts()}`,
        category: 'match',
        start_date: '2026-07-01',
        start_time: '10:00',
        end_time: '12:00',
        created_by: JOVIC_TATA_ID,
      })
      .select('id, title, category')
      .single();
    expect(error).toBeNull();
    expect(data?.category).toBe('match');
    if (data?.id) eventIds.push(data.id);
  });

  it('creates an all-day multi-day event', async () => {
    const { data, error } = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-multiday-${ts()}`,
        category: 'school',
        start_date: '2026-07-10',
        end_date: '2026-07-12',
        start_time: null,
        end_time: null,
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    if (data?.id) eventIds.push(data.id);
  });

  it('tags children via event_children join', async () => {
    const event = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-tagged-${ts()}`,
        category: 'birthday',
        start_date: '2026-08-15',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    expect(event.error).toBeNull();
    const eventId = event.data!.id;
    eventIds.push(eventId);

    const { error: joinErr } = await admin
      .from('event_children')
      .insert({ event_id: eventId, child_id: LUKA_CHILD_ID });
    expect(joinErr).toBeNull();

    const { data: links } = await admin
      .from('event_children')
      .select('child_id')
      .eq('event_id', eventId);
    expect(links?.map((l) => l.child_id)).toEqual([LUKA_CHILD_ID]);
  });

  it('updates an event in place', async () => {
    const created = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-edit-${ts()}`,
        category: 'other',
        start_date: '2026-09-01',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;
    eventIds.push(id);

    const { data, error } = await admin
      .from('events')
      .update({ title: 'renamed', category: 'doctor' })
      .eq('id', id)
      .select('title, category')
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe('renamed');
    expect(data?.category).toBe('doctor');
  });

  it('deletes an event and cascades event_children', async () => {
    const created = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-delete-${ts()}`,
        category: 'other',
        start_date: '2026-10-01',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;

    await admin.from('event_children').insert({ event_id: id, child_id: LUKA_CHILD_ID });

    const { error } = await admin.from('events').delete().eq('id', id);
    expect(error).toBeNull();

    const { data: orphans } = await admin
      .from('event_children')
      .select('event_id')
      .eq('event_id', id);
    expect(orphans).toEqual([]);
  });
});
