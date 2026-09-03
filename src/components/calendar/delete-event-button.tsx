'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { deleteEventAction } from '@/lib/calendar/event-actions';

interface Props {
  eventId: string;
}

export function DeleteEventButton({ eventId }: Props) {
  const t = useTranslations('events');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      // On success this never returns — the action redirects server-side, so
      // there is no client navigation to get stuck.
      const result = await deleteEventAction({ id: eventId, locale });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={onDelete}
      disabled={isPending}
      data-testid={`event-detail-delete-button-${eventId}`}
    >
      {isPending ? t('deleting') : t('delete')}
    </Button>
  );
}
