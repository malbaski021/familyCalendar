'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { relaunchOnboardingAction } from '@/lib/auth/onboarding-actions';

export function RelaunchOnboardingButton() {
  const t = useTranslations('settings.onboarding');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function relaunch() {
    startTransition(async () => {
      const result = await relaunchOnboardingAction();
      if (result.ok) {
        router.replace('/onboarding');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={relaunch}
      disabled={isPending}
      data-testid="settings-relaunch-onboarding-button"
    >
      {isPending ? t('relaunching') : t('relaunch')}
    </Button>
  );
}
