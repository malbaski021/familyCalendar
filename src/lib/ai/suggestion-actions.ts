'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { logAudit } from '@/lib/audit/log';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import type { ActionResult } from '@/lib/family/actions';

// Applying or rejecting an AI suggestion. Every one of these is a normal
// family-member write — `events`, `event_children`, `children` and
// `event_reminders` all have member-level RLS policies — so none of it needs
// the service client.
//
// Each action audits with actor_type 'user': the suggestion came from the AI,
// but the decision to apply it did not.

const CATEGORY_KEYS = Object.keys(CATEGORY_STYLES) as [string, ...string[]];

async function requireFamilyEvent(
  eventId: string,
): Promise<{ ok: true; familyId: string; userId: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const family = await getFamilyContextFor(user.authId);
  if (!family) return { ok: false, error: 'You are not part of a family yet' };

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('family_id', family.familyId)
    .maybeSingle();
  if (!data) return { ok: false, error: 'Event not found' };

  return { ok: true, familyId: family.familyId, userId: user.authId };
}

function revalidateEvent(eventId: string): void {
  revalidatePath('/[locale]/(app)/calendar', 'page');
  revalidatePath('/[locale]/(app)/calendar/[id]', 'page');
  void eventId;
}

/** Accept the suggested category. */
export async function applyCategoryAction(input: {
  eventId: string;
  category: string;
}): Promise<ActionResult<null>> {
  const parsed = z.enum(CATEGORY_KEYS).safeParse(input.category);
  if (!parsed.success) return { ok: false, error: 'Unknown category' };

  const ctx = await requireFamilyEvent(input.eventId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const { data: prev } = await supabase
    .from('events')
    .select('category')
    .eq('id', input.eventId)
    .maybeSingle();

  const { error } = await supabase
    .from('events')
    .update({ category: parsed.data as never })
    .eq('id', input.eventId)
    .eq('family_id', ctx.familyId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'ai.accepted',
    entity: 'events',
    entityId: input.eventId,
    oldData: prev ?? null,
    newData: { suggestion: 'category', category: parsed.data },
  });

  revalidateEvent(input.eventId);
  return { ok: true, data: null };
}

/**
 * Accept suggested child tags. Added to whatever is already tagged rather than
 * replacing it — the AI only ever saw the title, so it is in no position to
 * remove a tag the user set deliberately.
 */
export async function applyChildrenAction(input: {
  eventId: string;
  childIds: string[];
}): Promise<ActionResult<null>> {
  const ctx = await requireFamilyEvent(input.eventId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();

  // Only ids that really belong to this family — a suggestion must never be
  // able to tag another family's child.
  const { data: valid } = await supabase
    .from('children')
    .select('id')
    .eq('family_id', ctx.familyId)
    .in(
      'id',
      input.childIds.length > 0 ? input.childIds : ['00000000-0000-0000-0000-000000000000'],
    );

  const allowed = (valid ?? []).map((c) => c.id);
  if (allowed.length === 0) return { ok: false, error: 'No matching children' };

  const { error } = await supabase.from('event_children').upsert(
    allowed.map((childId) => ({ event_id: input.eventId, child_id: childId })),
    { onConflict: 'event_id,child_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'ai.accepted',
    entity: 'event_children',
    entityId: input.eventId,
    newData: { suggestion: 'children', child_ids: allowed },
  });

  revalidateEvent(input.eventId);
  return { ok: true, data: null };
}

const childNameSchema = z.string().trim().min(1).max(60);

/**
 * Register a name the AI spotted but that the family does not have yet, and
 * tag this event with it. Two steps on purpose: the model reports unknown
 * names separately from ids precisely so it can never invent a child silently.
 */
export async function addSuggestedChildAction(input: {
  eventId: string;
  name: string;
}): Promise<ActionResult<{ childId: string }>> {
  const parsed = childNameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, error: 'Invalid name' };

  const ctx = await requireFamilyEvent(input.eventId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();

  // Re-adding an existing name should tag, not duplicate.
  const { data: existing } = await supabase
    .from('children')
    .select('id')
    .eq('family_id', ctx.familyId)
    .ilike('name', parsed.data)
    .maybeSingle();

  let childId = existing?.id;
  if (!childId) {
    const { data: created, error } = await supabase
      .from('children')
      .insert({ family_id: ctx.familyId, name: parsed.data })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? 'Failed to add child' };
    childId = created.id;

    await logAudit({
      familyId: ctx.familyId,
      actorType: 'user',
      actorId: ctx.userId,
      action: 'child.added',
      entity: 'children',
      entityId: childId,
      newData: { name: parsed.data, via: 'ai-suggestion' },
    });
  }

  const { error: tagError } = await supabase
    .from('event_children')
    .upsert(
      { event_id: input.eventId, child_id: childId },
      { onConflict: 'event_id,child_id', ignoreDuplicates: true },
    );
  if (tagError) return { ok: false, error: tagError.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'ai.accepted',
    entity: 'children',
    entityId: childId,
    newData: { suggestion: 'new-child', name: parsed.data },
  });

  revalidateEvent(input.eventId);
  return { ok: true, data: { childId } };
}

/**
 * Persist the reminders the user ticked. Replaces the event's set so
 * unticking one removes it.
 *
 * `minutes_before` is `check (> 0)` in the schema while the AI schema permits
 * 0 ("at the time of the event"), so zero and negatives are dropped here
 * rather than being sent to Postgres to fail.
 */
export async function saveRemindersAction(input: {
  eventId: string;
  minutesBefore: number[];
}): Promise<ActionResult<{ saved: number }>> {
  const ctx = await requireFamilyEvent(input.eventId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const minutes = [...new Set(input.minutesBefore)]
    .filter((m) => Number.isInteger(m) && m > 0 && m <= 10080)
    .sort((a, b) => a - b);

  const supabase = await createServerClient();
  await supabase.from('event_reminders').delete().eq('event_id', input.eventId);

  if (minutes.length > 0) {
    const { error } = await supabase
      .from('event_reminders')
      .insert(minutes.map((m) => ({ event_id: input.eventId, minutes_before: m })));
    if (error) return { ok: false, error: error.message };
  }

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'ai.accepted',
    entity: 'event_reminders',
    entityId: input.eventId,
    newData: { suggestion: 'reminders', minutes_before: minutes },
  });

  revalidateEvent(input.eventId);
  return { ok: true, data: { saved: minutes.length } };
}

/**
 * Record that a suggestion was turned down. Nothing changes in the data — the
 * point is the audit trail, so a suggestion the family keeps rejecting is
 * visible rather than invisible.
 */
export async function dismissSuggestionAction(input: {
  eventId: string;
  kind: 'duplicate' | 'category' | 'children' | 'new-child' | 'reminders';
}): Promise<ActionResult<null>> {
  const ctx = await requireFamilyEvent(input.eventId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'ai.rejected',
    entity: 'events',
    entityId: input.eventId,
    newData: { suggestion: input.kind },
  });

  return { ok: true, data: null };
}
