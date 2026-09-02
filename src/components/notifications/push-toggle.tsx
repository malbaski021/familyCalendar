'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BellIcon, BellOffIcon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
  sendTestPushAction,
} from '@/lib/notifications/actions';

type State =
  | { kind: 'unsupported' }
  | { kind: 'ios-needs-install' }
  | { kind: 'permission-default' }
  | { kind: 'permission-denied' }
  | { kind: 'subscribed' }
  | { kind: 'unsubscribed' }
  | { kind: 'pending' };

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

// PushManager.subscribe expects the applicationServerKey as a BufferSource
// holding the url-safe base64 decoded VAPID public key. We copy into a fresh
// ArrayBuffer so TS's strict BufferSource typing is satisfied (the
// Uint8Array<ArrayBufferLike> default isn't assignable in all configs).
function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return buffer;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari-specific flag.
  return Boolean((window.navigator as { standalone?: boolean }).standalone);
}

export function PushToggle() {
  const t = useTranslations('notifications');
  const [state, setState] = useState<State>({ kind: 'pending' });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined') return;

      // iOS FIRST, before the capability probe below. Safari only exposes
      // `PushManager` once the site is installed to the Home Screen, so an
      // iPhone visiting in the browser fails the capability check and would be
      // told push is unsupported — which is both wrong and a dead end, since
      // installing is exactly what unlocks it. This ordering is the difference
      // between "your browser can't do this" and "here's how to enable it".
      if (isIos() && !isStandalone()) {
        setState({ kind: 'ios-needs-install' });
        return;
      }

      // Genuinely unsupported: no service worker or no push API even though we
      // are not in the iOS-needs-install case (e.g. an installed PWA on
      // iOS < 16.4, or a desktop browser without push).
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState({ kind: 'unsupported' });
        return;
      }
      // Browser permission state first — `default` means we haven't asked yet.
      if (Notification.permission === 'denied') {
        setState({ kind: 'permission-denied' });
        return;
      }
      if (Notification.permission === 'default') {
        setState({ kind: 'permission-default' });
        return;
      }
      // Granted — check whether we already have a subscription for this device.
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState({ kind: sub ? 'subscribed' : 'unsubscribed' });
    })();
  }, []);

  async function ensureSwRegistered(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return navigator.serviceWorker.register('/sw.js');
  }

  function subscribe() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setState({ kind: permission === 'denied' ? 'permission-denied' : 'permission-default' });
          return;
        }
        if (!VAPID_PUBLIC) {
          toast.error(t('errors.missingVapid'));
          return;
        }
        const reg = await ensureSwRegistered();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC),
        });
        const json = sub.toJSON();
        const result = await subscribeToPushAction({
          endpoint: json.endpoint!,
          keys: {
            p256dh: json.keys?.p256dh ?? '',
            auth: json.keys?.auth ?? '',
          },
          expirationTime: json.expirationTime ?? null,
        });
        if (result.ok) {
          setState({ kind: 'subscribed' });
          toast.success(t('subscribed'));
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('errors.subscribeFailed'));
      }
    });
  }

  function unsubscribe() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await unsubscribeFromPushAction({ endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        setState({ kind: 'unsubscribed' });
        toast.success(t('unsubscribed'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('errors.unsubscribeFailed'));
      }
    });
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestPushAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { sent, failed } = result.data;
      // "sent to 0 devices" reads like "you have no devices" when in fact the
      // send was attempted and rejected — which is a completely different
      // problem. Report the two cases separately.
      if (sent > 0) {
        toast.success(t('testSent', { sent }));
      } else if (failed > 0) {
        toast.error(t('errors.testFailed', { failed }));
      } else {
        toast.error(t('errors.noDevices'));
      }
    });
  }

  if (state.kind === 'pending') {
    return (
      <p className="text-muted-foreground text-sm" data-testid="push-status-loading">
        {t('checking')}
      </p>
    );
  }

  if (state.kind === 'unsupported') {
    return (
      <p className="text-muted-foreground text-sm" data-testid="push-status-unsupported">
        {t('unsupported')}
      </p>
    );
  }

  if (state.kind === 'ios-needs-install') {
    return (
      <div
        className="grid gap-2 rounded-lg border p-3 text-sm"
        data-testid="push-status-ios-install"
      >
        <p className="font-medium">{t('iosInstallTitle')}</p>
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs">
          <li>{t('iosInstallStep1')}</li>
          <li>{t('iosInstallStep2')}</li>
          <li>{t('iosInstallStep3')}</li>
        </ol>
      </div>
    );
  }

  if (state.kind === 'permission-denied') {
    return (
      <p className="text-muted-foreground text-sm" data-testid="push-status-denied">
        {t('denied')}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {state.kind === 'subscribed' ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={unsubscribe}
            disabled={isPending}
            data-testid="push-unsubscribe-button"
          >
            <BellOffIcon className="h-4 w-4" />
            {t('disable')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={sendTest}
            disabled={isPending}
            data-testid="push-test-button"
          >
            <SendIcon className="h-4 w-4" />
            {t('sendTest')}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={subscribe}
          disabled={isPending}
          data-testid="push-subscribe-button"
        >
          <BellIcon className="h-4 w-4" />
          {t('enable')}
        </Button>
      )}
    </div>
  );
}
