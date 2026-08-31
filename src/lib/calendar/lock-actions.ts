'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/lib/audit/log';
import { LOCK_TTL_MS } from '@/lib/calendar/lock-constants';
import type { ActionResult } from '@/lib/family/actions';

export interface LockState {
  lockedBy: string | null;
  lockedByUsername: string | null;
  lockedAt: string | null;
  /** True when the lock currently belongs to the calling user. */
  heldBySelf: boolean;
  /** True when the lock is held by someone else AND it hasn't expired. */
  heldByOther: boolean;
}

async function findFamilyForCurrentUser(): Promise<
  { ok: true; familyId: string; userId: string; username: string } | { ok: false; error: string }
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
  return {
    ok: true,
    familyId: data.family_id,
    userId: user.authId,
    username: user.profile.username,
  };
}

function isStale(lockedAt: string | null): boolean {
  if (!lockedAt) return true;
  return Date.now() - new Date(lockedAt).getTime() > LOCK_TTL_MS;
}

/** Read the current lock state of an event from the perspective of the caller. */
export async function describeLock(eventId: string): Promise<LockState> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) {
    return {
      lockedBy: null,
      lockedByUsername: null,
      lockedAt: null,
      heldBySelf: false,
      heldByOther: false,
    };
  }
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('events')
    .select('locked_by, locked_at, users:users!events_locked_by_fkey(username)')
    .eq('id', eventId)
    .eq('family_id', ctx.familyId)
    .maybeSingle();

  if (!data || !data.locked_by) {
    return {
      lockedBy: null,
      lockedByUsername: null,
      lockedAt: null,
      heldBySelf: false,
      heldByOther: false,
    };
  }

  const stale = isStale(data.locked_at);
  const username = Array.isArray(data.users)
    ? (data.users[0]?.username ?? null)
    : ((data.users as { username: string } | null)?.username ?? null);
  return {
    lockedBy: data.locked_by,
    lockedByUsername: username,
    lockedAt: data.locked_at,
    heldBySelf: data.locked_by === ctx.userId && !stale,
    heldByOther: data.locked_by !== ctx.userId && !stale,
  };
}

/**
 * Try to take the edit lock on an event. Succeeds when the row is unlocked,
 * the existing lock is stale (older than LOCK_TTL_MS), or the caller is
 * already the holder (in which case the lock_at is refreshed — heartbeat).
 * Returns `{ ok: false, error: 'locked-by-other', state }` on conflict so the
 * UI can render a read-only view.
 */
export async function acquireLockAction(
  eventId: string,
): Promise<
  { ok: true; data: { lockedAt: string } } | { ok: false; error: string; state?: LockState }
> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const now = new Date().toISOString();

  // Read current state first so we can decide whether to take it.
  const { data: existing, error: readError } = await supabase
    .from('events')
    .select('locked_by, locked_at')
    .eq('id', eventId)
    .eq('family_id', ctx.familyId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: 'Event not found' };

  const canTake =
    !existing.locked_by || existing.locked_by === ctx.userId || isStale(existing.locked_at);
  if (!canTake) {
    const state = await describeLock(eventId);
    return { ok: false, error: 'locked-by-other', state };
  }

  const { error: updateError } = await supabase
    .from('events')
    .update({ locked_by: ctx.userId, locked_at: now })
    .eq('id', eventId)
    .eq('family_id', ctx.familyId);
  if (updateError) return { ok: false, error: updateError.message };

  // Only emit an audit row when we actually take the lock from somebody else
  // (or from cold) — heartbeats would otherwise spam the log.
  if (existing.locked_by !== ctx.userId) {
    await logAudit({
      familyId: ctx.familyId,
      actorType: 'user',
      actorId: ctx.userId,
      action: 'event.lock_acquired',
      entity: 'events',
      entityId: eventId,
      oldData: existing,
      newData: { locked_by: ctx.userId, locked_at: now },
    });
  }

  return { ok: true, data: { lockedAt: now } };
}

/** Drop the lock if we currently hold it. No-op if someone else owns it. */
export async function releaseLockAction(eventId: string): Promise<ActionResult<null>> {
  const ctx = await findFamilyForCurrentUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createServerClient();
  const { error, data } = await supabase
    .from('events')
    .update({ locked_by: null, locked_at: null })
    .eq('id', eventId)
    .eq('family_id', ctx.familyId)
    .eq('locked_by', ctx.userId)
    .select('id');
  if (error) return { ok: false, error: error.message };

  if (data && data.length > 0) {
    await logAudit({
      familyId: ctx.familyId,
      actorType: 'user',
      actorId: ctx.userId,
      action: 'event.lock_released',
      entity: 'events',
      entityId: eventId,
    });
  }
  return { ok: true, data: null };
}
