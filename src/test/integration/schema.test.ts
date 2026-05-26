import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_LOCAL_URL!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TableName = keyof Database['public']['Tables'];

const EXPECTED_TABLES: TableName[] = [
  'ai_queue',
  'audit_log',
  'children',
  'drafts',
  'event_children',
  'event_instances',
  'event_reminders',
  'event_shares',
  'events',
  'families',
  'family_members',
  'invite_links',
  'notifications',
  'push_subscriptions',
  'users',
  'weather_cache',
];

describe('Schema', () => {
  it.each(EXPECTED_TABLES)('table %s exists and is queryable', async (table) => {
    // service_role bypasses RLS so this is a pure existence check
    const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
    expect(error).toBeNull();
  });

  it('auto-creates a public.users row when an auth user is inserted', async () => {
    const testEmail = `trigger-test-${Date.now()}@familycalendar.local`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: 'password123',
      email_confirm: true,
      user_metadata: { username: `trigger_test_${Date.now()}` },
    });
    expect(createError).toBeNull();
    expect(created.user).toBeTruthy();

    try {
      const { data: profile, error: profileError } = await admin
        .from('users')
        .select('id, username')
        .eq('id', created.user!.id)
        .single();
      expect(profileError).toBeNull();
      expect(profile?.username).toMatch(/^trigger_test_/);
    } finally {
      await admin.auth.admin.deleteUser(created.user!.id);
    }
  });
});
