'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/lib/audit/log';
import { eventInputSchema, type EventInput } from '@/lib/calendar/event-schema';
import type { ActionResult } from '@/lib/family/actions';

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
    // Users belong to at most one family in v1, but `family_members` is only
    // unique on (family_id, user_id) — nothing stops a second membership. Pick
    // the oldest deterministically so a bare `maybeSingle()` can't fail with
    // "multiple rows returned". Matches `getFamilyContextFor`.
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'You are not part of a family yet' };
  return { ok: true, familyId: data.family_id, userId: user.authId };
}

function toDbPayload(input: EventInput) {
  const pattern: 'daily' | 'weekly' | 'monthly' | null =
    input.recurrence === 'none' ? null : input.recurrence;
  return {
    title: input.title,
    category: input.category,
    start_date: input.startDate,
    end_date: input.endDate ?? null,
    start_time: input.allDay ? null : (input.startTime ?? null),
    end_time: input.allDay ? null : (input.endTime ?? null),
    location: input.location ?? null,
    notes: input.notes ?? null,
    recurring_pattern: pattern,
    recurring_end_date: pattern ? (input.recurringEndDate ?? null) : null,
  };
}

async function syncEventChildren(eventId: string, childIds: string[]): Promise<void> {
  const supabase = await createServerClient();
  // Replace the join rows with the new set in two steps — small N, no transaction needed.
  await supabase.from('event_children').delete().eq('event_id', eventId);
  if (childIds.length > 0) {
    await supabase
      .from('event_children')
      .insert(childIds.map((childId) => ({ event_id: eventId, child_id: childId })));
  }
}

export async function createEventAction(input: EventInput): Promise<ActionResult<{ id: string }>> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('events')
    .insert({
      ...toDbPayload(parsed.data),
      family_id: ctx.familyId,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create event' };

  await syncEventChildren(data.id, parsed.data.childIds);

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'event.created',
    entity: 'events',
    entityId: data.id,
    newData: { ...toDbPayload(parsed.data), child_ids: parsed.data.childIds },
  });

  return { ok: true, data };
}

export async function updateEventAction(input: {
  id: string;
  input: EventInput;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = eventInputSchema.safeParse(input.input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();

  // Read previous state for audit before we overwrite.
  const { data: prev } = await supabase
    .from('events')
    .select('title, category, start_date, end_date, start_time, end_time, location, notes')
    .eq('id', input.id)
    .eq('family_id', ctx.familyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('events')
    .update(toDbPayload(parsed.data))
    .eq('id', input.id)
    .eq('family_id', ctx.familyId)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to update event' };

  await syncEventChildren(data.id, parsed.data.childIds);

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'event.updated',
    entity: 'events',
    entityId: data.id,
    oldData: prev ?? null,
    newData: { ...toDbPayload(parsed.data), child_ids: parsed.data.childIds },
  });

  return { ok: true, data };
}

export async function deleteEventAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const { data: prev } = await supabase
    .from('events')
    .select('title, category, start_date, end_date, start_time, end_time')
    .eq('id', input.id)
    .eq('family_id', ctx.familyId)
    .maybeSingle();

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', input.id)
    .eq('family_id', ctx.familyId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'event.deleted',
    entity: 'events',
    entityId: input.id,
    oldData: prev ?? null,
  });

  return { ok: true, data: { id: input.id } };
}

/**
 * Cancel a single occurrence of a recurring series. Persists as an
 * `event_instances` row with `is_cancelled = true`; the master event row
 * stays intact so future occurrences keep firing. Idempotent via an UPSERT
 * on `(event_id, instance_date)`.
 */
export async function cancelInstanceAction(input: {
  eventId: string;
  instanceDate: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();

  // Confirm the event belongs to the caller's family (RLS would too — belt + braces).
  const { data: master } = await supabase
    .from('events')
    .select('id')
    .eq('id', input.eventId)
    .eq('family_id', ctx.familyId)
    .maybeSingle();
  if (!master) return { ok: false, error: 'Event not found' };

  const { error } = await supabase
    .from('event_instances')
    .upsert(
      { event_id: input.eventId, instance_date: input.instanceDate, is_cancelled: true },
      { onConflict: 'event_id,instance_date' },
    );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'event_instance.cancelled',
    entity: 'event_instances',
    entityId: input.eventId,
    newData: { instance_date: input.instanceDate },
  });

  return { ok: true, data: { id: input.eventId } };
}

/**
 * Override a single occurrence — title / location / notes / start_time /
 * end_time. The master event stays unchanged; other occurrences in the
 * series are not affected. Upsert on `(event_id, instance_date)`.
 */
export async function overrideInstanceAction(input: {
  eventId: string;
  instanceDate: string;
  overrides: {
    title?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    notes?: string | null;
  };
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();

  const { data: master } = await supabase
    .from('events')
    .select('id')
    .eq('id', input.eventId)
    .eq('family_id', ctx.familyId)
    .maybeSingle();
  if (!master) return { ok: false, error: 'Event not found' };

  const { error } = await supabase.from('event_instances').upsert(
    {
      event_id: input.eventId,
      instance_date: input.instanceDate,
      is_cancelled: false,
      override_title: input.overrides.title ?? null,
      override_start_time: input.overrides.startTime ?? null,
      override_end_time: input.overrides.endTime ?? null,
      override_location: input.overrides.location ?? null,
      override_notes: input.overrides.notes ?? null,
    },
    { onConflict: 'event_id,instance_date' },
  );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'event_instance.updated',
    entity: 'event_instances',
    entityId: input.eventId,
    newData: { instance_date: input.instanceDate, ...input.overrides },
  });

  return { ok: true, data: { id: input.eventId } };
}
