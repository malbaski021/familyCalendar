'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ChildrenManager } from '@/components/family/children-manager';
import { completeOnboardingAction } from '@/lib/auth/onboarding-actions';

interface Child {
  id: string;
  name: string;
}

interface Props {
  initialChildren: Child[];
  /** Server-resolved username so the welcome screen can greet the user. */
  username: string;
}

type Step = 1 | 2 | 3;

export function OnboardingShell({ initialChildren, username }: Props) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();
  // Optional client-only state to reflect what the browser said about notification permission.
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported' | null>(
    null,
  );

  function finish() {
    startTransition(async () => {
      // On success this never returns — the action redirects server-side, which
      // is what stops the client router replaying its cached `/calendar` →
      // `/onboarding` bounce from before onboarding was complete.
      const result = await completeOnboardingAction({ locale });
      if (!result.ok) toast.error(result.error);
    });
  }

  async function askForNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifStatus('unsupported');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm === 'denied') {
        toast.info(t('step3.deniedHint'));
      }
    } catch {
      setNotifStatus('default');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {t('progress', { current: step, total: 3 })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t(`step${step}.title`)}</h1>
        <p className="text-muted-foreground text-sm">{t(`step${step}.subtitle`)}</p>
      </header>

      {step === 1 && (
        <section className="grid gap-4">
          <p>{t('step1.body', { username })}</p>
          <Button
            type="button"
            onClick={() => setStep(2)}
            data-testid="onboarding-step1-continue-button"
          >
            {t('continue')}
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="grid gap-4">
          <ChildrenManager initial={initialChildren} testIdPrefix="onboarding-step2-children" />
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(3)}
              data-testid="onboarding-step2-skip-button"
            >
              {t('skip')}
            </Button>
            <Button
              type="button"
              onClick={() => setStep(3)}
              data-testid="onboarding-step2-continue-button"
            >
              {t('continue')}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="grid gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={askForNotifications}
            data-testid="onboarding-step3-enable-button"
          >
            {t('step3.enable')}
          </Button>
          {notifStatus && (
            <p className="text-muted-foreground text-sm" data-testid="onboarding-step3-status">
              {t(`step3.status.${notifStatus}`)}
            </p>
          )}
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={finish}
              disabled={isPending}
              data-testid="onboarding-step3-skip-button"
            >
              {t('skip')}
            </Button>
            <Button
              type="button"
              onClick={finish}
              disabled={isPending}
              data-testid="onboarding-step3-finish-button"
            >
              {isPending ? t('finishing') : t('finish')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
