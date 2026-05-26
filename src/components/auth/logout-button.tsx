'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/auth/actions';

export function LogoutButton({ className }: { className?: string }) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      disabled={isPending}
      onClick={() => startTransition(() => logoutAction())}
    >
      {isPending ? t('logout.submitting') : t('logout.submit')}
    </Button>
  );
}
