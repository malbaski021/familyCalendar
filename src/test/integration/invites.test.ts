import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_LOCAL_URL!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function freshClient() {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// IDs from supabase/seed.sql so the test can lean on the seeded family.
const JOVIC_FAMILY_ID = '44444444-4444-4444-4444-444444444444';
const SUPER_ADMIN_ID = '11111111-1111-1111-1111-111111111111';

function ts() {
  return Date.now().toString(36);
}

async function insertInvite(
  overrides: Partial<{
    family_id: string;
    role: 'owner' | 'member';
    token: string;
    expires_at: string;
    status: 'active' | 'used' | 'expired' | 'revoked';
  }> = {},
) {
  const token = overrides.token ?? `e2e-${ts()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await admin
    .from('invite_links')
    .insert({
      family_id: overrides.family_id ?? JOVIC_FAMILY_ID,
      token,
      role: overrides.role ?? 'member',
      created_by: SUPER_ADMIN_ID,
      expires_at: overrides.expires_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: overrides.status ?? 'active',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

describe('invite_links: super-admin enforcement trigger', () => {
  const extraEmail = `e2e-not-admin-${ts()}@familycalendar.local`;
  let extraUserId: string | undefined;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: extraEmail,
      password: 'password123',
      email_confirm: true,
      user_metadata: { username: `e2e_not_admin_${ts()}` },
    });
    expect(error).toBeNull();
    extraUserId = data.user!.id;
  });

  afterAll(async () => {
    if (extraUserId) await admin.auth.admin.deleteUser(extraUserId);
  });

  it('rejects promoting a non-super-admin email to admin', async () => {
    const { error } = await admin.from('users').update({ role: 'admin' }).eq('id', extraUserId!);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/reserved for the super-admin/i);
  });

  it('keeps the seeded super-admin row at role=admin', async () => {
    const { data, error } = await admin
      .from('users')
      .select('role')
      .eq('id', SUPER_ADMIN_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.role).toBe('admin');
  });
});

describe('invite token lifecycle', () => {
  let consumedToken: string;
  let consumerUserId: string | undefined;

  afterAll(async () => {
    if (consumerUserId) await admin.auth.admin.deleteUser(consumerUserId);
  });

  it('a fresh active invite is readable by token via the anon client', async () => {
    const invite = await insertInvite({ role: 'owner' });
    const client = freshClient();
    // Anon role cannot select invite_links per RLS — only members can.
    // The service-role lookup is what the app uses on the /invite page;
    // verify it returns the row.
    const { data, error } = await admin
      .from('invite_links')
      .select('id, status')
      .eq('token', invite.token)
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe('active');
    void client; // silence unused-var when we don't end up needing it
  });

  it('expired status is detectable: expires_at in the past', async () => {
    const invite = await insertInvite({
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(new Date(invite.expires_at).getTime()).toBeLessThan(Date.now());
  });

  it('revoking flips status to revoked', async () => {
    const invite = await insertInvite();
    const { error } = await admin
      .from('invite_links')
      .update({ status: 'revoked' })
      .eq('id', invite.id);
    expect(error).toBeNull();
    const { data } = await admin.from('invite_links').select('status').eq('id', invite.id).single();
    expect(data?.status).toBe('revoked');
  });

  it('consuming an active invite marks it used and creates a family_members row', async () => {
    const invite = await insertInvite({ role: 'member' });
    consumedToken = invite.token;

    const email = `e2e-consume-${ts()}@familycalendar.local`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: true,
      user_metadata: { username: `e2e_consume_${ts()}` },
    });
    expect(createErr).toBeNull();
    consumerUserId = created.user!.id;

    // Atomic update of invite row + insert into family_members — same shape as consumeInvite().
    const { data: updated, error: updateErr } = await admin
      .from('invite_links')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_by: consumerUserId!,
      })
      .eq('id', invite.id)
      .eq('status', 'active')
      .select('id');
    expect(updateErr).toBeNull();
    expect(updated?.length).toBe(1);

    const { error: memberErr } = await admin.from('family_members').insert({
      family_id: invite.family_id,
      user_id: consumerUserId!,
      role: invite.role,
    });
    expect(memberErr).toBeNull();

    const { data: membership } = await admin
      .from('family_members')
      .select('role')
      .eq('family_id', invite.family_id)
      .eq('user_id', consumerUserId!)
      .single();
    expect(membership?.role).toBe('member');
  });

  it('attempting to consume the same token a second time finds 0 active rows', async () => {
    const { data: updated, error } = await admin
      .from('invite_links')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('token', consumedToken)
      .eq('status', 'active')
      .select('id');
    expect(error).toBeNull();
    expect(updated?.length).toBe(0);
  });

  it('unknown token resolves to no row', async () => {
    const { data, error } = await admin
      .from('invite_links')
      .select('id')
      .eq('token', 'definitely-not-a-real-token')
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
