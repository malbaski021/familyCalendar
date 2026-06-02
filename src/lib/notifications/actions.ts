'use server';

import { headers } from 'next/headers';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { sendPush } from '@/lib/notifications/web-push';
import { logAudit } from '@/lib/audit/log';
import type { ActionResult } from '@/lib/family/actions';

interface SubscriptionPayload {
  endpoint: string;
  // Native `PushSubscriptionJSON` shape — keys come back as { p256dh, auth }.
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

function detectDeviceType(ua: string): string {
  const lower = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(lower)) return 'ios';
  if (/android/.test(lower)) return 'android';
  return 'desktop';
}

/** Persist a fresh PushSubscription so the server can target this device later. */
export async function subscribeToPushAction(
  subscription: SubscriptionPayload,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const headerStore = await headers();
  const ua = headerStore.get('user-agent') ?? '';

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.authId,
        endpoint: subscription.endpoint,
        subscription_data: subscription as never,
        device_type: detectDeviceType(ua),
        user_agent: ua.slice(0, 500),
      },
      { onConflict: 'endpoint' },
    )
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to save subscription' };
  }

  await logAudit({
    actorType: 'user',
    actorId: user.authId,
    action: 'push.subscribed',
    entity: 'push_subscriptions',
    entityId: data.id,
    newData: { device_type: detectDeviceType(ua) },
  });

  return { ok: true, data };
}

/** Drop the subscription tied to a specific endpoint (called from the same browser). */
export async function unsubscribeFromPushAction(input: {
  endpoint: string;
}): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.authId)
    .eq('endpoint', input.endpoint);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorType: 'user',
    actorId: user.authId,
    action: 'push.unsubscribed',
    entity: 'push_subscriptions',
  });
  return { ok: true, data: null };
}

/**
 * Send a "hello world" push to the current user across all their devices.
 * Useful for the Settings → Notifications "Send test" button.
 */
export async function sendTestPushAction(): Promise<
  ActionResult<{ sent: number; failed: number }>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const headerStore = await headers();
  const host = headerStore.get('host') ?? 'localhost:3000';
  const proto =
    headerStore.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  try {
    const result = await sendPush({
      userId: user.authId,
      type: 'test',
      payload: {
        title: 'Family Calendar',
        body: 'Push notifications are working on this device.',
        url: `${proto}://${host}/en/calendar`,
        tag: 'test-push',
      },
    });
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Push failed' };
  }
}
