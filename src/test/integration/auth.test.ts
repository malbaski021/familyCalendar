import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_LOCAL_URL!;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function freshClient() {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const TEST_EMAIL = `e2e-auth-${Date.now()}@familycalendar.local`;
const TEST_USERNAME = `e2e_auth_${Date.now()}`;
const TEST_PASSWORD = 'password123';
let createdUserId: string | undefined;

describe('Auth: signUp + signIn lifecycle', () => {
  beforeAll(async () => {
    // Use the public anon client so we exercise the same path the SignUpForm does.
    const client = freshClient();
    const { data, error } = await client.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      options: { data: { username: TEST_USERNAME } },
    });
    expect(error).toBeNull();
    expect(data.user).toBeTruthy();
    createdUserId = data.user!.id;
  });

  afterAll(async () => {
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId);
    }
  });

  it('creates a matching public.users profile via trigger', async () => {
    const { data, error } = await admin
      .from('users')
      .select('id, username, role, status')
      .eq('id', createdUserId!)
      .single();
    expect(error).toBeNull();
    expect(data?.username).toBe(TEST_USERNAME);
    expect(data?.role).toBe('user');
    expect(data?.status).toBe('active');
  });

  it('signInWithPassword returns a session with a JWT', async () => {
    const client = freshClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    expect(data.user?.id).toBe(createdUserId);
  });

  it('rejects sign-in with wrong password', async () => {
    const client = freshClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: 'wrong-password',
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });
});
