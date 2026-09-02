'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deleteFamilyAction } from '@/lib/family/actions';

interface Props {
  familyId: string;
  familyName: string;
  memberCount: number;
  testIdPrefix: string;
}

export function DeleteFamilyDialog({ familyId, familyName, memberCount, testIdPrefix }: Props) {
  const t = useTranslations('admin.deleteFamily');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reopening must not inherit a ticked checkbox from the previous attempt,
  // or a second delete could go through on a single click.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirmed(false);
      setError(null);
    }
  }

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteFamilyAction({ familyId });
      if (result.ok) {
        toast.success(t('success', { name: familyName }));
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const checkboxId = `${testIdPrefix}-delete-confirm`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`${testIdPrefix}-delete-button`}>
          {t('trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent data-testid={`${testIdPrefix}-delete-dialog`}>
        <DialogHeader>
          <DialogTitle>{t('title', { name: familyName })}</DialogTitle>
          <DialogDescription>{t('description', { count: memberCount })}</DialogDescription>
        </DialogHeader>

        <label htmlFor={checkboxId} className="flex items-start gap-2 text-sm">
          <input
            id={checkboxId}
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 size-4 shrink-0"
            data-testid={`${testIdPrefix}-delete-confirm-checkbox`}
          />
          <span>{t('confirmLabel', { name: familyName })}</span>
        </label>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="outline"
              disabled={isPending}
              data-testid={`${testIdPrefix}-delete-cancel-button`}
            >
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            // Stays disabled until the checkbox is ticked — the whole point of
            // the extra step.
            disabled={!confirmed || isPending}
            onClick={onDelete}
            data-testid={`${testIdPrefix}-delete-submit-button`}
          >
            {isPending ? t('deleting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
