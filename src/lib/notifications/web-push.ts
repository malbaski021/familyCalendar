import 'server-only';
import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/service';

let configured = false;
function configure(): void {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'VAPID env vars missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT',
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type NotificationType =
  | 'event_reminder'
  | 'ai_complete'
  | 'draft_warning'
  | 'lock_released'
  | 'test';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Fan a push out to every subscription registered for `userId`. Logs one row
 * per send attempt in `public.notifications`. A subscription that returns
 * 404 / 410 is deleted (the browser revoked it) so we stop trying.
 *
 * Service-role client is used because:
 *   - Notifications fire from server contexts that may not have a user session
 *     (cron jobs, lock-expiry callbacks).
 *   - Inserts into `notifications` and deletes of stale `push_subscriptions`
 *     should not be limited by RLS.
 */
export async function sendPush(params: {
  userId: string;
  type: NotificationType;
  payload: PushPayload;
  eventId?: string | null;
}): Promise<{ sent: number; failed: number }> {
  configure();
  const supabase = createServiceClient();

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, subscription_data')
    .eq('user_id', params.userId);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const { error: queueError, data: row } = await supabase
      .from('notifications')
      .insert({
        user_id: params.userId,
        event_id: params.eventId ?? null,
        type: params.type,
        payload: params.payload as never,
        status: 'queued',
      })
      .select('id')
      .single();
    if (queueError || !row) {
      failed += 1;
      continue;
    }

    try {
      await webpush.sendNotification(
        sub.subscription_data as never,
        JSON.stringify(params.payload),
      );
      await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sub.id);
      sent += 1;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : 0;
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from('notifications')
        .update({ status: 'failed', error: message })
        .eq('id', row.id);
      // 404 / 410 → the subscription is dead, drop it so future sends don't keep trying.
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
      failed += 1;
    }
  }
  return { sent, failed };
}
