'use server';

import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/lib/audit/log';
import type { ActionResult } from '@/lib/family/actions';

const childNameSchema = z
  .string()
  .min(1, { message: 'Child name is required' })
  .max(60, { message: 'Child name must be at most 60 characters' });

async function findFamilyForCurrentUser(): Promise<
  { ok: true; familyId: string; userId: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.authId)
    // See `getFamilyContextFor`: pick the oldest membership deterministically
    // so a second family row can't turn this into a "multiple rows" error.
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'You are not part of a family yet' };
  return { ok: true, familyId: data.family_id, userId: user.authId };
}

export async function addChildAction(input: {
  name: string;
}): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = childNameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid name' };
  }

  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('children')
    .insert({ family_id: ctx.familyId, name: parsed.data })
    .select('id, name')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to add child' };
  }

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'child.added',
    entity: 'children',
    entityId: data.id,
    newData: { name: data.name },
  });

  return { ok: true, data };
}

export async function renameChildAction(input: {
  id: string;
  name: string;
}): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = childNameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid name' };
  }

  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from('children')
    .select('name')
    .eq('id', input.id)
    .eq('family_id', ctx.familyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('children')
    .update({ name: parsed.data })
    .eq('id', input.id)
    .eq('family_id', ctx.familyId)
    .select('id, name')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to rename child' };
  }

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'child.renamed',
    entity: 'children',
    entityId: data.id,
    oldData: existing ? { name: existing.name } : null,
    newData: { name: data.name },
  });

  return { ok: true, data };
}

export async function removeChildAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from('children')
    .select('name')
    .eq('id', input.id)
    .eq('family_id', ctx.familyId)
    .maybeSingle();

  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', input.id)
    .eq('family_id', ctx.familyId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'child.removed',
    entity: 'children',
    entityId: input.id,
    oldData: existing ? { name: existing.name } : null,
  });

  return { ok: true, data: { id: input.id } };
}
