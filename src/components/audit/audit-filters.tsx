'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActorFilter, ActionFilter } from '@/lib/audit/query';

interface Props {
  current: {
    actor: ActorFilter;
    action: ActionFilter;
    from: string;
    to: string;
    q: string;
  };
}

const ACTORS: ActorFilter[] = ['all', 'me', 'others', 'ai', 'system'];
const ACTIONS: ActionFilter[] = ['all', 'created', 'edited', 'deleted', 'notifications', 'ai'];

/**
 * Filter form for the audit log. State lives in the URL; submitting the form
 * navigates with new search params so the result is shareable and the
 * browser back-button works as a "undo filter" out of the box.
 */
export function AuditFilters({ current }: Props) {
  const t = useTranslations('audit.filters');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ['actor', 'action', 'from', 'to', 'q'] as const) {
      const value = String(fd.get(key) ?? '').trim();
      if (value && value !== 'all' && value !== '') params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`);
    });
  }

  function onReset() {
    startTransition(() => router.replace(pathname));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5"
      data-testid="audit-filters-form"
    >
      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground tracking-wide uppercase">{t('actor')}</span>
        <select
          name="actor"
          defaultValue={current.actor}
          className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          data-testid="audit-filters-actor-select"
        >
          {ACTORS.map((a) => (
            <option key={a} value={a}>
              {t(`actorOption.${a}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground tracking-wide uppercase">{t('action')}</span>
        <select
          name="action"
          defaultValue={current.action}
          className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          data-testid="audit-filters-action-select"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(`actionOption.${a}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground tracking-wide uppercase">{t('from')}</span>
        <Input
          name="from"
          type="date"
          defaultValue={current.from}
          data-testid="audit-filters-from-input"
        />
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground tracking-wide uppercase">{t('to')}</span>
        <Input
          name="to"
          type="date"
          defaultValue={current.to}
          data-testid="audit-filters-to-input"
        />
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground tracking-wide uppercase">{t('search')}</span>
        <Input
          name="q"
          type="search"
          defaultValue={current.q}
          placeholder={t('searchPlaceholder')}
          data-testid="audit-filters-search-input"
        />
      </label>

      <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-5">
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          disabled={isPending}
          data-testid="audit-filters-reset-button"
        >
          {t('reset')}
        </Button>
        <Button type="submit" disabled={isPending} data-testid="audit-filters-apply-button">
          {isPending ? t('applying') : t('apply')}
        </Button>
      </div>
    </form>
  );
}
