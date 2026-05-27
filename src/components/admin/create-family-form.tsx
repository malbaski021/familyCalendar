'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createFamilyAction } from '@/lib/family/actions';

export function CreateFamilyForm() {
  const t = useTranslations('admin.createFamily');
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createFamilyAction({ name });
      if (result.ok) {
        toast.success(t('success'));
        setName('');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2" data-testid="create-family-form">
      <label htmlFor="family-name" className="text-sm font-medium">
        {t('label')}
      </label>
      <div className="flex gap-2">
        <Input
          id="family-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Petrovic"
          autoComplete="off"
          data-testid="create-family-form-name-input"
        />
        <Button
          type="submit"
          disabled={isPending || name.trim().length < 2}
          data-testid="create-family-form-submit-button"
        >
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
