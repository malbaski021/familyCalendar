'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/get-current-user';
import { signUpSchema, type SignUpInput } from '@/lib/auth/schemas';
import {
  consumeInvite,
  createInvite,
  inviteUrl,
  revokeInvite,
  validateInvite,
} from '@/lib/family/invites';
import { slugify } from '@/lib/family/slugify';
import { logAudit } from '@/lib/audit/log';

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  if (user.profile.role !== 'admin') throw new Error('Forbidden');
  return user;
}

async function requireOwnerOf(familyId: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('family_members')
    .select('role')
    .eq('family_id', familyId)
    .eq('user_id', user.authId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== 'owner') throw new Error('Forbidden');
  return user;
}

const createFamilySchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Family name must be at least 2 characters' })
    .max(80, { message: 'Family name must be at most 80 characters' }),
});

export async function createFamilyAction(input: {
  name: string;
}): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = createFamilySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const admin = await requireAdmin().catch((e: Error) => e);
  if (admin instanceof Error) return { ok: false, error: admin.message };

  const supabase = await createServerClient();
  const baseSlug = slugify(parsed.data.name) || 'family';

  // Append short suffix only if base slug collides — keeps URLs short for the common case.
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 5) {
    const { data: clash } = await supabase
      .from('families')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!clash) break;
    attempt += 1;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data, error } = await supabase
    .from('families')
    .insert({ name: parsed.data.name, slug, created_by: admin.authId })
    .select('id, slug')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create family' };

  await logAudit({
    familyId: data.id,
    actorType: 'user',
    actorId: admin.authId,
    action: 'family.created',
    entity: 'families',
    entityId: data.id,
    newData: { name: parsed.data.name, slug: data.slug },
  });

  return { ok: true, data };
}

/**
 * Delete a family and, by FK cascade, everything belonging to it: members,
 * children, invite links, events and all of their dependants (instances,
 * reminders, shares, drafts, queued AI tasks), plus every audit row carrying
 * this family_id.
 *
 * Admin only — enforced here and again by the `families: admin can delete`
 * RLS policy.
 *
 * User accounts are deliberately NOT removed. A person is not family data:
 * dropping their login because a calendar was deleted would be a surprising
 * side effect, and `public.users` does not cascade from `families` anyway.
 */
export async function deleteFamilyAction(input: {
  familyId: string;
}): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin().catch((e: Error) => e);
  if (admin instanceof Error) return { ok: false, error: admin.message };

  const supabase = await createServerClient();

  // Snapshot before it disappears — this is the only record left afterwards.
  const { data: family } = await supabase
    .from('families')
    .select('id, name, slug, created_at')
    .eq('id', input.familyId)
    .maybeSingle();
  if (!family) return { ok: false, error: 'Family not found' };

  const { data: members } = await supabase
    .from('family_members')
    .select('role, users(username)')
    .eq('family_id', input.familyId);

  const { error } = await supabase.from('families').delete().eq('id', input.familyId);
  if (error) return { ok: false, error: error.message };

  // Logged with familyId null on purpose: `audit_log.family_id` cascades on
  // family delete, so an entry tagged with this family would be wiped by the
  // very deletion it records.
  await logAudit({
    familyId: null,
    actorType: 'user',
    actorId: admin.authId,
    action: 'family.deleted',
    entity: 'families',
    entityId: family.id,
    oldData: {
      ...family,
      members: (members ?? []).map((m) => {
        const profile = Array.isArray(m.users) ? m.users[0] : m.users;
        return { role: m.role, username: profile?.username ?? null };
      }),
    },
  });

  return { ok: true, data: { id: family.id } };
}

async function buildInviteUrl(token: string, role: 'owner' | 'member'): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get('host') ?? 'localhost:3000';
  const proto =
    headerStore.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return inviteUrl(`${proto}://${host}`, role, token);
}

export async function generateOwnerInviteAction(input: {
  familyId: string;
}): Promise<ActionResult<{ token: string; url: string; expiresAt: string }>> {
  const admin = await requireAdmin().catch((e: Error) => e);
  if (admin instanceof Error) return { ok: false, error: admin.message };

  try {
    const row = await createInvite({
      familyId: input.familyId,
      role: 'owner',
      createdBy: admin.authId,
    });
    const url = await buildInviteUrl(row.token, 'owner');
    await logAudit({
      familyId: row.family_id,
      actorType: 'user',
      actorId: admin.authId,
      action: 'invite_link.generated',
      entity: 'invite_links',
      entityId: row.id,
      newData: { role: row.role, expires_at: row.expires_at },
    });
    return { ok: true, data: { token: row.token, url, expiresAt: row.expires_at } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to issue invite' };
  }
}

export async function generateMemberInviteAction(input: {
  familyId: string;
}): Promise<ActionResult<{ token: string; url: string; expiresAt: string }>> {
  const owner = await requireOwnerOf(input.familyId).catch((e: Error) => e);
  if (owner instanceof Error) return { ok: false, error: owner.message };

  try {
    const row = await createInvite({
      familyId: input.familyId,
      role: 'member',
      createdBy: owner.authId,
    });
    const url = await buildInviteUrl(row.token, 'member');
    await logAudit({
      familyId: row.family_id,
      actorType: 'user',
      actorId: owner.authId,
      action: 'invite_link.generated',
      entity: 'invite_links',
      entityId: row.id,
      newData: { role: row.role, expires_at: row.expires_at },
    });
    return { ok: true, data: { token: row.token, url, expiresAt: row.expires_at } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to issue invite' };
  }
}

export async function regenerateInviteAction(input: {
  inviteId: string;
}): Promise<ActionResult<{ token: string; url: string; expiresAt: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const supabase = await createServerClient();
  const { data: invite, error } = await supabase
    .from('invite_links')
    .select('id, family_id, role, created_by')
    .eq('id', input.inviteId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!invite) return { ok: false, error: 'Invite not found' };

  // Only the original creator or an admin can regenerate.
  if (invite.created_by !== user.authId && user.profile.role !== 'admin') {
    return { ok: false, error: 'Forbidden' };
  }

  try {
    await revokeInvite(invite.id);
    const fresh = await createInvite({
      familyId: invite.family_id,
      role: invite.role,
      createdBy: user.authId,
    });
    const url = await buildInviteUrl(fresh.token, fresh.role);
    await logAudit({
      familyId: invite.family_id,
      actorType: 'user',
      actorId: user.authId,
      action: 'invite_link.regenerated',
      entity: 'invite_links',
      entityId: fresh.id,
      oldData: { id: invite.id },
      newData: { role: fresh.role, expires_at: fresh.expires_at },
    });
    return { ok: true, data: { token: fresh.token, url, expiresAt: fresh.expires_at } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to regenerate' };
  }
}

const acceptInviteSchema = signUpSchema.extend({
  token: z.string().min(4),
});

export async function acceptInviteAction(
  input: SignUpInput & { token: string },
): Promise<ActionResult<{ familyId: string }>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { email, username, password, token } = parsed.data;

  const validation = await validateInvite(token);
  if (!validation.ok) {
    return { ok: false, error: `Invite ${validation.reason}` };
  }

  const supabase = await createServerClient();

  // Username uniqueness before we create the auth user.
  const { data: clash } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (clash) return { ok: false, error: 'Username is already taken' };

  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (signUpError || !signUp.user) {
    return { ok: false, error: signUpError?.message ?? 'Failed to sign up' };
  }

  try {
    const { family_id } = await consumeInvite({ token, userId: signUp.user.id });
    await logAudit({
      familyId: family_id,
      actorType: 'user',
      actorId: signUp.user.id,
      action: 'invite_link.used',
      entity: 'invite_links',
      entityId: validation.invite.id,
      newData: { role: validation.invite.role },
    });
    return { ok: true, data: { familyId: family_id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to accept invite' };
  }
}
