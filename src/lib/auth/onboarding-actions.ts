'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/lib/audit/log';
import type { ActionResult } from '@/lib/family/actions';

/**
 * Mark the current user as having completed the onboarding wizard.
 * Service-role client is used because the regular RLS policy on
 * `public.users` forbids self-updating columns other than `username`
 * and `language`.
 */
export async function completeOnboardingAction(): Promise<ActionResult<{ onboardedAt: string }>> {
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

  return { ok: true, data: { onboardedAt: now } };
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
