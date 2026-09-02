'use server';

import { redirect } from '@/i18n/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/lib/audit/log';
import type { ActionResult } from '@/lib/family/actions';

/**
 * Mark the current user as having completed the onboarding wizard, then send
 * them to the calendar.
 *
 * The redirect happens here rather than with `router.replace` on the client,
 * and that is deliberate. `/calendar` is normally visited *before* onboarding
 * finishes, when the guard bounces it back to `/onboarding`; the client router
 * caches that bounce. A client-side `replace('/calendar')` then replays the
 * cached redirect and the user never leaves the wizard. A server redirect is
 * not served from that cache.
 *
 * Service-role client is used because the RLS policy on `public.users` forbids
 * self-updating columns other than `username` and `language`.
 */
export async function completeOnboardingAction(input: {
  locale: string;
}): Promise<ActionResult<never>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({ onboarded_at: now })
    .eq('id', user.authId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorType: 'user',
    actorId: user.authId,
    action: 'onboarding.completed',
    entity: 'users',
    entityId: user.authId,
    newData: { onboarded_at: now },
  });

  // Throws NEXT_REDIRECT — nothing after this runs, and the client never sees
  // a resolved result on the success path. The throw below is unreachable and
  // only there because next-intl's `redirect` isn't typed as `never`; same
  // pattern as `@/lib/auth/guards`.
  redirect({ href: '/calendar', locale: input.locale });
  throw new Error('unreachable');
}

/**
 * Reset onboarding state so the next protected-page hit sends the user
 * through the wizard again. Triggered from Settings → "Relaunch onboarding".
 */
export async function relaunchOnboardingAction(): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('users')
    .update({ onboarded_at: null })
    .eq('id', user.authId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorType: 'user',
    actorId: user.authId,
    action: 'onboarding.relaunched',
    entity: 'users',
    entityId: user.authId,
  });

  return { ok: true, data: null };
}
