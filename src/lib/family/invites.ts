import 'server-only';
import { customAlphabet } from 'nanoid';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/types/database';

// 48h invite lifetime (in milliseconds). Centralised so tests and UI agree.
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

// URL-safe characters only, length 12 → ~71 bits of entropy. Plenty for
// single-use tokens that also have a 48h expiry and live behind a unique index.
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const generateNanoid = customAlphabet(TOKEN_ALPHABET, 12);

export type InviteRole = Database['public']['Enums']['family_member_role'];
export type InviteLinkStatus = Database['public']['Enums']['invite_link_status'];

export type InviteRow = Database['public']['Tables']['invite_links']['Row'];

export interface ValidatedInvite {
  id: string;
  token: string;
  family_id: string;
  family_name: string;
  family_slug: string;
  role: InviteRole;
  expires_at: string;
}

export type InviteValidationError = 'not-found' | 'used' | 'expired' | 'revoked';

/** Build the token string we store and put into the URL: `<family-slug>-<nanoid>`. */
export function buildToken(familySlug: string): string {
  return `${familySlug}-${generateNanoid()}`;
}

/** Returns the absolute URL the user clicks to accept an invite. Locale-agnostic
 *  on purpose — next-intl middleware will redirect to the user's preferred locale. */
export function inviteUrl(origin: string, role: InviteRole, token: string): string {
  return `${origin}/invite/${role}/${token}`;
}

/**
 * Create an invite, persisted with `status = 'active'`. Caller is responsible
 * for authorising: admin issues `owner` invites, family owner issues `member`
 * invites. RLS enforces this in the DB layer as a defence in depth.
 */
export async function createInvite(params: {
  familyId: string;
  role: InviteRole;
  createdBy: string;
}): Promise<InviteRow> {
  const supabase = await createServerClient();

  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('slug')
    .eq('id', params.familyId)
    .single();
  if (familyError || !family) {
    throw new Error(`Family ${params.familyId} not found`);
  }

  const token = buildToken(family.slug);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('invite_links')
    .insert({
      family_id: params.familyId,
      token,
      role: params.role,
      created_by: params.createdBy,
      expires_at: expiresAt,
      status: 'active',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create invite link');
  }
  return data;
}

/**
 * Look up an invite by token and verify it can still be redeemed.
 * Returns a discriminated union so callers can render specific messages
 * for expired vs already-used vs revoked tokens.
 *
 * Uses the service role so the invite page can validate before the user
 * is authenticated.
 */
export async function validateInvite(
  token: string,
): Promise<{ ok: true; invite: ValidatedInvite } | { ok: false; reason: InviteValidationError }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('invite_links')
    .select('id, token, family_id, role, expires_at, used_at, status, families!inner(name, slug)')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'not-found' };
  if (data.status === 'used' || data.used_at) return { ok: false, reason: 'used' };
  if (data.status === 'revoked') return { ok: false, reason: 'revoked' };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  return {
    ok: true,
    invite: {
      id: data.id,
      token: data.token,
      family_id: data.family_id,
      family_name: data.families.name,
      family_slug: data.families.slug,
      role: data.role,
      expires_at: data.expires_at,
    },
  };
}

/**
 * Mark an invite as consumed and insert the corresponding `family_members` row
 * atomically — both via the service-role client so the steps don't require the
 * brand-new user's RLS context.
 *
 * Returns the family the user just joined, so the caller can redirect into it.
 */
export async function consumeInvite(params: {
  token: string;
  userId: string;
}): Promise<{ family_id: string }> {
  const supabase = createServiceClient();

  // Re-validate inside the same call to avoid TOCTOU between page render
  // and form submission.
  const validation = await validateInvite(params.token);
  if (!validation.ok) {
    throw new Error(`Invite ${validation.reason}`);
  }

  const invite = validation.invite;

  const { data: updated, error: updateError } = await supabase
    .from('invite_links')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      used_by: params.userId,
    })
    .eq('id', invite.id)
    .eq('status', 'active') // optimistic lock — racing consume hits 0 rows
    .select('id');
  if (updateError) {
    throw new Error(`Failed to mark invite used: ${updateError.message}`);
  }
  if (!updated || updated.length === 0) {
    // Lost the race: another request consumed this token between validate and update.
    throw new Error('Invite used');
  }

  const { error: memberError } = await supabase.from('family_members').insert({
    family_id: invite.family_id,
    user_id: params.userId,
    role: invite.role,
  });
  if (memberError) {
    throw new Error(`Failed to add family member: ${memberError.message}`);
  }

  return { family_id: invite.family_id };
}

/**
 * Revoke an existing invite (idempotent — re-running on a used or already-revoked
 * row is a no-op). Used by the "regenerate" flow before issuing the replacement.
 */
export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('invite_links')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('status', 'active');
  if (error) {
    throw new Error(`Failed to revoke invite: ${error.message}`);
  }
}
