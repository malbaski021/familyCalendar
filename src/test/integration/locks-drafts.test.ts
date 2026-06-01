import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_LOCAL_URL!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const JOVIC_FAMILY_ID = '44444444-4444-4444-4444-444444444444';
const JOVIC_TATA_ID = '22222222-2222-2222-2222-222222222222';
const JOVIC_MAMA_ID = '33333333-3333-3333-3333-333333333333';

function ts() {
  return Date.now().toString(36);
}

describe('event locks', () => {
  let eventId: string;

  beforeAll(async () => {
    const { data } = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-lock-${ts()}`,
        category: 'other',
        start_date: '2026-09-15',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    eventId = data!.id;
  });

  afterAll(async () => {
    await admin.from('events').delete().eq('id', eventId);
  });

  it('persists locked_by + locked_at when a user takes the lock', async () => {
    const now = new Date().toISOString();
    const { error } = await admin
      .from('events')
      .update({ locked_by: JOVIC_TATA_ID, locked_at: now })
      .eq('id', eventId);
    expect(error).toBeNull();

    const { data } = await admin
      .from('events')
      .select('locked_by, locked_at')
      .eq('id', eventId)
      .single();
    expect(data?.locked_by).toBe(JOVIC_TATA_ID);
    expect(data?.locked_at).not.toBeNull();
  });

  it('clears the lock when released', async () => {
    const { error } = await admin
      .from('events')
      .update({ locked_by: null, locked_at: null })
      .eq('id', eventId);
    expect(error).toBeNull();

    const { data } = await admin
      .from('events')
      .select('locked_by, locked_at')
      .eq('id', eventId)
      .single();
    expect(data?.locked_by).toBeNull();
    expect(data?.locked_at).toBeNull();
  });

  it('preserves a stale lock until somebody actively takes over', async () => {
    // Simulate a lock taken 30 minutes ago — past the 15-min TTL.
    const staleAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await admin
      .from('events')
      .update({ locked_by: JOVIC_TATA_ID, locked_at: staleAt })
      .eq('id', eventId);

    // The row still has the stale lock until the next acquire overwrites it.
    // (The app-level helper treats it as free, but the DB row is untouched
    // until somebody explicitly UPDATEs it.)
    const { data } = await admin
      .from('events')
      .select('locked_by, locked_at')
      .eq('id', eventId)
      .single();
    expect(data?.locked_by).toBe(JOVIC_TATA_ID);
    expect(new Date(data!.locked_at!).getTime()).toBeLessThan(Date.now() - 15 * 60 * 1000);

    // Mama takes over — this is what acquireLockAction does internally.
    const fresh = new Date().toISOString();
    const { error } = await admin
      .from('events')
      .update({ locked_by: JOVIC_MAMA_ID, locked_at: fresh })
      .eq('id', eventId);
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('events')
      .select('locked_by')
      .eq('id', eventId)
      .single();
    expect(after?.locked_by).toBe(JOVIC_MAMA_ID);
  });
});

describe('drafts', () => {
  let eventId: string;
  const draftEventIds: string[] = [];

  beforeAll(async () => {
    const { data } = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-draft-${ts()}`,
        category: 'other',
        start_date: '2026-09-20',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    eventId = data!.id;
    draftEventIds.push(eventId);
  });

  afterAll(async () => {
    await admin.from('events').delete().in('id', draftEventIds);
  });

  it('upserts a draft for the (event_id, user_id) pair', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const { error } = await admin.from('drafts').upsert(
      {
        event_id: eventId,
        user_id: JOVIC_TATA_ID,
        draft_data: { title: 'changed title', notes: 'wip' },
        expires_at: expiresAt,
      },
      { onConflict: 'event_id,user_id' },
    );
    expect(error).toBeNull();

    const { data } = await admin
      .from('drafts')
      .select('draft_data, expires_at')
      .eq('event_id', eventId)
      .eq('user_id', JOVIC_TATA_ID)
      .single();
    const payload = data?.draft_data as { title: string; notes: string } | null;
    expect(payload?.title).toBe('changed title');
    expect(payload?.notes).toBe('wip');
  });

  it('a second upsert with same key replaces the existing row, not duplicates', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await admin.from('drafts').upsert(
      {
        event_id: eventId,
        user_id: JOVIC_TATA_ID,
        draft_data: { title: 'replaced' },
        expires_at: expiresAt,
      },
      { onConflict: 'event_id,user_id' },
    );
    const { data } = await admin
      .from('drafts')
      .select('id, draft_data')
      .eq('event_id', eventId)
      .eq('user_id', JOVIC_TATA_ID);
    expect(data).toHaveLength(1);
    expect((data?.[0]?.draft_data as { title: string }).title).toBe('replaced');
  });

  it('drafts cascade away when the parent event is deleted', async () => {
    const fresh = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        title: `e2e-draft-cascade-${ts()}`,
        category: 'other',
        start_date: '2026-09-25',
        created_by: JOVIC_TATA_ID,
      })
      .select('id')
      .single();
    const cascadeId = fresh.data!.id;
    await admin.from('drafts').insert({
      event_id: cascadeId,
      user_id: JOVIC_TATA_ID,
      draft_data: { x: 1 },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    await admin.from('events').delete().eq('id', cascadeId);

    const { data } = await admin.from('drafts').select('id').eq('event_id', cascadeId);
    expect(data).toEqual([]);
  });
});
