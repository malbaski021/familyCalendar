import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_LOCAL_URL!;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY!;

// Seeded family IDs (from supabase/seed.sql)
const JOVIC_FAMILY = '44444444-4444-4444-4444-444444444444';
const SMITH_FAMILY = '77777777-7777-7777-7777-777777777777';

function freshClient() {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAs(email: string) {
  const client = freshClient();
  const { error } = await client.auth.signInWithPassword({ email, password: 'password123' });
  expect(error, `signing in as ${email}`).toBeNull();
  return client;
}

describe('RLS: cross-family isolation', () => {
  it('anonymous user sees no events', async () => {
    const anon = freshClient();
    const { data, error } = await anon.from('events').select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('jovic_tata sees only Jovic family events, not Smith', async () => {
    const client = await signInAs('jovic.tata@familycalendar.local');
    const { data, error } = await client.from('events').select('id, family_id');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(row.family_id).toBe(JOVIC_FAMILY);
    }
  });

  it('smith_dad sees only Smith family events, not Jovic', async () => {
    const client = await signInAs('smith.dad@familycalendar.local');
    const { data, error } = await client.from('events').select('id, family_id');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(row.family_id).toBe(SMITH_FAMILY);
    }
  });

  it('jovic_tata cannot insert an event into Smith family', async () => {
    const client = await signInAs('jovic.tata@familycalendar.local');
    const { error } = await client.from('events').insert({
      family_id: SMITH_FAMILY,
      title: 'Sneaky event',
      category: 'other',
      start_date: '2030-01-01',
      created_by: '22222222-2222-2222-2222-222222222222',
    });
    expect(error).not.toBeNull();
  });
});

describe('RLS: users profile visibility', () => {
  it('jovic_tata sees jovic_mama (same family) and self', async () => {
    const client = await signInAs('jovic.tata@familycalendar.local');
    const { data, error } = await client.from('users').select('username');
    expect(error).toBeNull();
    const usernames = (data ?? []).map((u) => u.username).sort();
    expect(usernames).toContain('jovic_tata');
    expect(usernames).toContain('jovic_mama');
    expect(usernames).not.toContain('smith_dad');
  });
});

describe('RLS: per-user resources', () => {
  it('jovic_tata cannot read jovic_mama push subscriptions', async () => {
    const client = await signInAs('jovic.tata@familycalendar.local');
    const { data, error } = await client
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', '33333333-3333-3333-3333-333333333333');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
