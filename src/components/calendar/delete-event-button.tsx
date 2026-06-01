'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { deleteEventAction } from '@/lib/calendar/event-actions';

interface Props {
  eventId: string;
}

export function DeleteEventButton({ eventId }: Props) {
  const t = useTranslations('events');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      const result = await deleteEventAction({ id: eventId });
      if (result.ok) {
        toast.success(t('deleted'));
        router.replace('/calendar');
        router.refresh();
      } else {
        toast.error(result.error);
      }
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
