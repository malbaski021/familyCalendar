'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { EventForm } from '@/components/calendar/event-form';
import { acquireLockAction, releaseLockAction } from '@/lib/calendar/lock-actions';
import { discardDraftAction, saveDraftAction } from '@/lib/calendar/draft-actions';
import { LOCK_TTL_MS } from '@/lib/calendar/lock-constants';
import type { EventInput } from '@/lib/calendar/event-schema';

interface Child {
  id: string;
  name: string;
}

interface Props {
  eventId: string;
  initial: EventInput;
  familyChildren: Child[];
  /** Whether a draft already exists on entry (we render a "restore draft" banner if so). */
  hasDraft: boolean;
  /** When `hasDraft` is true, the draft data we pre-fill into the form on Accept. */
  draftValues: EventInput | null;
  /** Original master values, used when the user discards the draft. */
  cleanValues: EventInput;
}

// Soft warning fires this long before the hard expiry so the user can save manually.
const SOFT_WARN_MS = 10 * 60 * 1000;
// Heartbeat — re-acquire the lock every 5 minutes so the server-side TTL
// doesn't time us out while we're actively editing.
const HEARTBEAT_MS = 5 * 60 * 1000;

/**
 * Edit-page client shell. Owns the four timers around the existing
 * EventForm:
 *   1. Heartbeat (every 5 min) → acquireLockAction refreshes the lock_at.
 *   2. Soft warn (T+10 min)    → toast "save your draft?".
 *   3. Hard expire (T+15 min)  → auto-save draft + release lock + render
 *                                a banner explaining the form is sealed.
 *   4. Save / Cancel           → release lock + (Save) discard draft.
 *
 * EventForm's own submit handler already navigates on success; this shell
 * just hooks into the same `eventId` for lock/draft side effects via the
 * window event-bus pattern (CustomEvent).
 */
export function EditLockShell({
  eventId,
  initial,
  familyChildren,
  hasDraft,
  draftValues,
  cleanValues,
}: Props) {
  const t = useTranslations('events.lock');
  const tDraft = useTranslations('events.draft');
  const router = useRouter();

  const [restoreDraftConfirmed, setRestoreDraftConfirmed] = useState<boolean | null>(
    hasDraft ? null : true,
  );
  const [expired, setExpired] = useState(false);
  // Used by the unload handler to know we shouldn't try to release after success.
  const releasedRef = useRef(false);
  // Stable ref to the current form values, fed by EventForm via the change bus.
  const latestValuesRef = useRef<EventInput>(
    restoreDraftConfirmed && draftValues ? draftValues : cleanValues,
  );

  // === Timers ============================================================
  useEffect(() => {
    if (restoreDraftConfirmed === null) return; // still waiting on user choice
    if (expired) return;

    const startedAt = Date.now();
    const heartbeat = window.setInterval(() => {
      void acquireLockAction(eventId).catch(() => {
        /* swallow — failure to refresh just means the lock could time out */
      });
    }, HEARTBEAT_MS);

    const softWarn = window.setTimeout(() => {
      toast.info(tDraft('softWarn'), { duration: 8000 });
    }, SOFT_WARN_MS);

    const hardExpire = window.setTimeout(async () => {
      try {
        await saveDraftAction({ eventId, draftData: latestValuesRef.current });
      } catch {
        /* draft save can fail (offline?) — we still need to release the lock */
      }
      await releaseLockAction(eventId).catch(() => undefined);
      releasedRef.current = true;
      setExpired(true);
      toast.warning(tDraft('expired'));
    }, LOCK_TTL_MS);

    return () => {
      window.clearInterval(heartbeat);
      window.clearTimeout(softWarn);
      window.clearTimeout(hardExpire);
      void startedAt; // referenced only for side-effect symmetry; lint hint
    };
  }, [eventId, expired, restoreDraftConfirmed, tDraft]);

  // === Event bus from EventForm =========================================
  // EventForm doesn't know about locks/drafts — we listen for the success +
  // values events it dispatches so we can release the lock and discard the
  // draft when the user actually saves.
  useEffect(() => {
    function onValues(e: Event) {
      const detail = (e as CustomEvent).detail as EventInput | undefined;
      if (detail) latestValuesRef.current = detail;
    }
    function onSubmitted(e: Event) {
      const detail = (e as CustomEvent).detail as { eventId: string } | undefined;
      if (detail?.eventId !== eventId) return;
      releasedRef.current = true;
      void releaseLockAction(eventId).catch(() => undefined);
      void discardDraftAction({ eventId }).catch(() => undefined);
    }
    window.addEventListener('event-form:values', onValues as EventListener);
    window.addEventListener('event-form:submitted', onSubmitted as EventListener);
    return () => {
      window.removeEventListener('event-form:values', onValues as EventListener);
      window.removeEventListener('event-form:submitted', onSubmitted as EventListener);
    };
  }, [eventId]);

  // === Best-effort lock release on browser navigation away ==============
  useEffect(() => {
    function onBeforeUnload() {
      if (releasedRef.current || expired) return;
      // We can't await server actions here — fire and forget; the server-side
      // 15-min TTL is the real safety net.
      void releaseLockAction(eventId).catch(() => undefined);
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [eventId, expired]);

  // === Draft restore prompt =============================================
  if (restoreDraftConfirmed === null) {
    return (
      <div
        className="border-primary/30 bg-primary/10 grid gap-2 rounded-lg border p-4 text-sm"
        data-testid="event-form-draft-prompt"
      >
        <p className="font-medium">{tDraft('promptTitle')}</p>
        <p className="text-muted-foreground text-xs">{tDraft('promptBody')}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setRestoreDraftConfirmed(true)}
            data-testid="event-form-draft-restore-button"
          >
            {tDraft('restore')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void discardDraftAction({ eventId }).catch(() => undefined);
              setRestoreDraftConfirmed(false);
            }}
            data-testid="event-form-draft-discard-button"
          >
            {tDraft('discard')}
          </Button>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div
        className="border-destructive/40 bg-destructive/10 grid gap-2 rounded-lg border p-4 text-sm"
        data-testid="event-form-expired-banner"
      >
        <p className="font-medium">{tDraft('expiredTitle')}</p>
        <p className="text-muted-foreground text-xs">{tDraft('expiredBody')}</p>
        <Button
          type="button"
          size="sm"
          onClick={() => router.replace(`/calendar/${eventId}`)}
          data-testid="event-form-expired-back-button"
        >
          {t('backToDetail')}
        </Button>
      </div>
    );
  }

  const effectiveInitial = restoreDraftConfirmed && draftValues ? draftValues : initial;

  return (
    <EventForm
      mode="edit"
      eventId={eventId}
      initial={effectiveInitial}
      familyChildren={familyChildren}
    />
  );
}
