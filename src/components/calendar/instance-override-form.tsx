'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { overrideInstanceAction } from '@/lib/calendar/event-actions';

interface Initial {
  title: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
}

interface Props {
  eventId: string;
  instanceDate: string;
  initial: Initial;
}

/**
 * Minimal form for overriding the per-occurrence fields of a recurring
 * series. Only the fields that make sense to vary per date are exposed —
 * title, start_time / end_time, location, notes. The master event row is
 * untouched and other occurrences keep their original values.
 */
export function InstanceOverrideForm({ eventId, instanceDate, initial }: Props) {
  const t = useTranslations('events');
  const tForm = useTranslations('events.form');
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [startTime, setStartTime] = useState(initial.startTime ?? '');
  const [endTime, setEndTime] = useState(initial.endTime ?? '');
  const [location, setLocation] = useState(initial.location ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await overrideInstanceAction({
        eventId,
        instanceDate,
        overrides: {
          title: title.trim() === '' ? null : title.trim(),
          startTime: startTime || null,
          endTime: endTime || null,
          location: location.trim() === '' ? null : location.trim(),
          notes: notes.trim() === '' ? null : notes.trim(),
        },
      });
      if (result.ok) {
        toast.success(t('instance.overrideSaved'));
        router.replace(`/calendar/${eventId}?date=${instanceDate}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" data-testid="instance-override-form">
      <p className="text-muted-foreground text-sm">{t('instance.overrideHelp')}</p>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">{tForm('title')}</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          maxLength={120}
          data-testid="instance-override-form-title-input"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{tForm('startTime')}</span>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            data-testid="instance-override-form-start-time-input"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{tForm('endTime')}</span>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            data-testid="instance-override-form-end-time-input"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">{tForm('location')}</span>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          autoComplete="off"
          data-testid="instance-override-form-location-input"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">{tForm('notes')}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border-input bg-background min-h-[80px] rounded-md border px-3 py-2 text-sm"
          data-testid="instance-override-form-notes-input"
        />
      </label>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          data-testid="instance-override-form-cancel-button"
        >
          {tForm('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          data-testid="instance-override-form-submit-button"
        >
          {isPending ? tForm('submitting') : tForm('save')}
        </Button>
      </div>
    </form>
  );
}
