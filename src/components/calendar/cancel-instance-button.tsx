'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cancelInstanceAction } from '@/lib/calendar/event-actions';

interface Props {
  eventId: string;
  instanceDate: string;
}

export function CancelInstanceButton({ eventId, instanceDate }: Props) {
  const t = useTranslations('events');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onCancel() {
    if (!window.confirm(t('instance.cancelOccurrenceConfirm', { date: instanceDate }))) return;
    startTransition(async () => {
      const result = await cancelInstanceAction({ eventId, instanceDate });
      if (result.ok) {
        toast.success(t('instance.cancelled'));
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
      onClick={onCancel}
      disabled={isPending}
      data-testid={`event-detail-cancel-instance-button-${eventId}-${instanceDate}`}
    >
      {t('instance.cancelOccurrence')}
    </Button>
  );
}
