import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// The admin "Delete family" flow leans entirely on FK cascades, so this asserts
// the cascade actually reaches every dependent table — and that the audit trail
// of the deletion survives, which it only does because the row is written with
// family_id null (audit_log.family_id cascades from families).
//
// The action itself needs an authenticated admin session, which this harness
// has no way to produce, so the DELETE is issued directly. What is under test
// is the schema's behaviour, which is what the action depends on.

const admin = createClient<Database>(
  process.env.SUPABASE_LOCAL_URL!,
  process.env.SUPABASE_LOCAL_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const JOVIC_TATA_ID = '22222222-2222-2222-2222-222222222222';
/** `families.created_by` is NOT NULL; the seed creates families as the admin. */
const SEED_ADMIN_ID = '11111111-1111-1111-1111-111111111111';

let familyId: string;
let eventId: string;
let childId: string;
let inviteId: string;

describe('deleting a family cascades', () => {
  beforeAll(async () => {
    const { data: family, error: famErr } = await admin
      .from('families')
      .select('id')
      .eq('slug', 'delete-cascade-fixture')
      .maybeSingle();
    expect(famErr).toBeNull();

    if (family) {
      familyId = family.id;
    } else {
      const { data, error } = await admin
        .from('families')
        .insert({
          name: 'Delete Cascade Fixture',
          slug: 'delete-cascade-fixture',
          created_by: SEED_ADMIN_ID,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      familyId = data!.id;
    }

    const { data: child } = await admin
      .from('children')
      .insert({ family_id: familyId, name: 'Cascade Child' })
      .select('id')
      .single();
    childId = child!.id;

    const { data: event } = await admin
      .from('events')
      .insert({
        family_id: familyId,
        created_by: JOVIC_TATA_ID,
        title: 'cascade-fixture-event',
        category: 'other',
        start_date: '2033-01-15',
      })
      .select('id')
      .single();
    eventId = event!.id;

    // One dependant per level below `events`, to prove the cascade is not
    // stopping at the first hop.
    await admin.from('event_children').insert({ event_id: eventId, child_id: childId });
    await admin
      .from('event_instances')
      .insert({ event_id: eventId, instance_date: '2033-01-15', is_cancelled: true });
    await admin
      .from('ai_queue')
      .insert({ event_id: eventId, tasks: { version: 1 } as never, status: 'pending' });

    const { data: invite } = await admin
      .from('invite_links')
      .insert({
        family_id: familyId,
        token: `delete-cascade-${Date.now()}`,
        role: 'member',
        created_by: JOVIC_TATA_ID,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        status: 'active',
      })
      .select('id')
      .single();
    inviteId = invite!.id;

    // Two audit rows: one tagged with the family (cascades away) and one
    // without (must survive), mirroring what `deleteFamilyAction` writes.
    await admin.from('audit_log').insert([
      {
        family_id: familyId,
        actor_type: 'user',
        actor_id: JOVIC_TATA_ID,
        action: 'event.created',
        entity: 'events',
        entity_id: eventId,
      },
      {
        family_id: null,
        actor_type: 'user',
        actor_id: JOVIC_TATA_ID,
        action: 'family.deleted',
        entity: 'families',
        entity_id: familyId,
        old_data: { name: 'Delete Cascade Fixture' } as never,
      },
    ]);
  });

  afterAll(async () => {
    // The family delete does the cleanup; this only catches an aborted run.
    if (familyId) await admin.from('families').delete().eq('id', familyId);
    await admin.from('audit_log').delete().eq('entity_id', familyId).is('family_id', null);
  });

  it('removes the family and every dependent row', async () => {
    const { error } = await admin.from('families').delete().eq('id', familyId);
    expect(error).toBeNull();

    const gone = async (
      table: 'children' | 'invite_links' | 'events',
      column: string,
      id: string,
    ) => {
      const { count } = await admin
        .from(table)
        .select('*', { head: true, count: 'exact' })
        .eq(column, id);
      return count ?? 0;
    };

    expect(await gone('children', 'id', childId)).toBe(0);
    expect(await gone('invite_links', 'id', inviteId)).toBe(0);
    expect(await gone('events', 'id', eventId)).toBe(0);

    // Two levels below `events` — proves the cascade chains rather than
    // stopping at the direct children of `families`.
    for (const table of ['event_children', 'event_instances', 'ai_queue'] as const) {
      const { count } = await admin
        .from(table)
        .select('*', { head: true, count: 'exact' })
        .eq('event_id', eventId);
      expect(count ?? 0, `${table} should be empty`).toBe(0);
    }
  });

  it('takes family-tagged audit rows with it', async () => {
    const { count } = await admin
      .from('audit_log')
      .select('*', { head: true, count: 'exact' })
      .eq('family_id', familyId);
    expect(count ?? 0).toBe(0);
  });

  it('keeps the family.deleted audit row, which is why it is written with a null family_id', async () => {
    const { data } = await admin
      .from('audit_log')
      .select('action, old_data')
      .eq('entity_id', familyId)
      .eq('action', 'family.deleted');

    // If this ever returns nothing, deleting a family leaves no trace at all.
    expect(data?.length).toBe(1);
    expect((data![0].old_data as { name: string }).name).toBe('Delete Cascade Fixture');
  });
});
