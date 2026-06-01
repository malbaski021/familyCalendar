'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  eventId: string;
  /** Username of the other family member currently holding the edit lock. */
  lockedByUsername: string | null;
  /** ISO timestamp the lock was acquired — used to surface "since X" copy. */
  lockedAt: string | null;
}

/**
 * Read-only banner shown above the (hidden) edit form when another family
 * member is currently editing the same event. The banner is a Server-component-
 * safe wrapper around a small bit of i18n + a "Back" link, but it's a client
 * component so the `useFormatter()` hook can localise the relative time.
 */
export function EditLockBanner({ eventId, lockedByUsername, lockedAt }: Props) {
  const t = useTranslations('events.lock');
  const format = useFormatter();
  // next-intl's relativeTime() with a single Date arg formats relative to "now"
  // internally — avoids the React purity lint hit from a direct Date.now() call.
  const sinceLabel = lockedAt ? format.relativeTime(new Date(lockedAt)) : null;

  return (
    <div
      className="border-destructive/40 bg-destructive/10 grid gap-2 rounded-lg border p-4 text-sm"
      role="alert"
      data-testid={`edit-lock-banner-${eventId}`}
    >
      <p className="font-medium">
        {t('lockedTitle', { user: lockedByUsername ?? t('lockedFallback') })}
      </p>
      <p className="text-muted-foreground text-xs">
        {sinceLabel ? t('lockedSince', { when: sinceLabel }) : t('lockedHint')}
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/calendar/${eventId}`} data-testid={`edit-lock-banner-back-link-${eventId}`}>
            {t('backToDetail')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
