'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  /** Current search params that already filter the feed; we keep them on jumps. */
  searchParams: Record<string, string | undefined>;
}

export function AuditPagination({ page, pageSize, total, searchParams }: Props) {
  const t = useTranslations('audit.pagination');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function jump(next: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== 'page') params.set(k, v);
    }
    if (next > 1) params.set('page', String(next));
    startTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`);
    });
  }

  return (
    <div className="text-muted-foreground flex items-center justify-between gap-2 px-2 py-3 text-xs">
      <span data-testid="audit-pagination-summary">{t('summary', { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => jump(Math.max(1, page - 1))}
          disabled={page <= 1 || isPending}
          aria-label={t('prev')}
          data-testid="audit-pagination-prev-button"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <span data-testid="audit-pagination-page">{t('pageOf', { page, total: totalPages })}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => jump(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || isPending}
          aria-label={t('next')}
          data-testid="audit-pagination-next-button"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
