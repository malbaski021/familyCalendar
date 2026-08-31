'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/lib/audit/log';
import { DRAFT_TTL_MS } from '@/lib/calendar/lock-constants';
import type { EventInput } from '@/lib/calendar/event-schema';
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
    // See `getFamilyContextFor`: pick the oldest membership deterministically
    // so a second family row can't turn this into a "multiple rows" error.
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'You are not part of a family yet' };
  return { ok: true, familyId: data.family_id, userId: user.authId };
}

/** Save (or replace) the current user's draft of an event's edit form. */
export async function saveDraftAction(input: {
  eventId: string;
  draftData: EventInput;
}): Promise<ActionResult<{ savedAt: string }>> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS).toISOString();
  const { error } = await supabase.from('drafts').upsert(
    {
      event_id: input.eventId,
      user_id: ctx.userId,
      // draft_data is jsonb; cast through unknown so the Json union doesn't
      // force every callsite to know about the typing quirk.
      draft_data: input.draftData as never,
      expires_at: expiresAt,
    },
    { onConflict: 'event_id,user_id' },
  );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'event.draft_saved',
    entity: 'drafts',
    entityId: input.eventId,
    newData: { event_id: input.eventId, expires_at: expiresAt },
  });

  return { ok: true, data: { savedAt: new Date().toISOString() } };
}

/** Fetch the current user's draft for a given event, if any. */
export async function getDraft(
  eventId: string,
): Promise<{ draftData: EventInput; updatedAt: string } | null> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('drafts')
    .select('draft_data, updated_at, expires_at')
    .eq('event_id', eventId)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!data) return null;
  // Reject expired drafts on read so the cron's lateness can't show a stale draft.
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return {
    draftData: data.draft_data as unknown as EventInput,
    updatedAt: data.updated_at,
  };
}

export async function discardDraftAction(input: { eventId: string }): Promise<ActionResult<null>> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('event_id', input.eventId)
    .eq('user_id', ctx.userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    familyId: ctx.familyId,
    actorType: 'user',
    actorId: ctx.userId,
    action: 'event.draft_discarded',
    entity: 'drafts',
    entityId: input.eventId,
  });

  return { ok: true, data: null };
}
