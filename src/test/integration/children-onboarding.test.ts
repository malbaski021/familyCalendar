import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_LOCAL_URL!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const JOVIC_FAMILY_ID = '44444444-4444-4444-4444-444444444444';

function ts() {
  return Date.now().toString(36);
}

describe('children CRUD against seeded family', () => {
  const childIds: string[] = [];

  afterAll(async () => {
    if (childIds.length > 0) {
      await admin.from('children').delete().in('id', childIds);
    }
  });

  it('inserts a child for a family', async () => {
    const name = `e2e-child-${ts()}`;
    const { data, error } = await admin
      .from('children')
      .insert({ family_id: JOVIC_FAMILY_ID, name })
      .select('id, name, family_id')
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe(name);
    expect(data?.family_id).toBe(JOVIC_FAMILY_ID);
    if (data?.id) childIds.push(data.id);
  });

  it('updates the child name', async () => {
    const created = await admin
      .from('children')
      .insert({ family_id: JOVIC_FAMILY_ID, name: `e2e-rename-${ts()}` })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;
    childIds.push(id);

    const newName = `e2e-renamed-${ts()}`;
    const { data, error } = await admin
      .from('children')
      .update({ name: newName })
      .eq('id', id)
      .select('name')
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe(newName);
  });

  it('deletes a child by id', async () => {
    const created = await admin
      .from('children')
      .insert({ family_id: JOVIC_FAMILY_ID, name: `e2e-delete-${ts()}` })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;

    const { error } = await admin.from('children').delete().eq('id', id);
    expect(error).toBeNull();

    const { data } = await admin.from('children').select('id').eq('id', id).maybeSingle();
    expect(data).toBeNull();
  });
});

describe('users.onboarded_at lifecycle', () => {
  let userId: string | undefined;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `e2e-onboard-${ts()}@familycalendar.local`,
      password: 'password123',
      email_confirm: true,
      user_metadata: { username: `e2e_onboard_${ts()}` },
    });
    expect(error).toBeNull();
    userId = data.user!.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it('new users start with onboarded_at = null', async () => {
    const { data, error } = await admin
      .from('users')
      .select('onboarded_at')
      .eq('id', userId!)
      .single();
    expect(error).toBeNull();
    expect(data?.onboarded_at).toBeNull();
  });

  it('completing onboarding writes a timestamp', async () => {
    const before = Date.now();
    const { error } = await admin
      .from('users')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', userId!);
    expect(error).toBeNull();
    const { data } = await admin.from('users').select('onboarded_at').eq('id', userId!).single();
    expect(data?.onboarded_at).not.toBeNull();
    // Compare via Date parsing — Postgres roundtrips ISO with `+00:00` while
    // toISOString() emits `Z`; both represent the same instant.
    const stored = new Date(data!.onboarded_at!).getTime();
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('relaunching onboarding clears the timestamp back to null', async () => {
    const { error } = await admin.from('users').update({ onboarded_at: null }).eq('id', userId!);
    expect(error).toBeNull();
    const { data } = await admin.from('users').select('onboarded_at').eq('id', userId!).single();
    expect(data?.onboarded_at).toBeNull();
  });
});
