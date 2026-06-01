'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AuditEntry } from '@/lib/audit/query';

interface Props {
  entry: AuditEntry;
}

/**
 * One row of the audit feed. Compact by default — click to reveal the JSON
 * snapshot of `old_data` / `new_data`. Uses `useFormatter` for relative time
 * so the locale picker reflects in dates without a custom helper.
 */
export function AuditEntryRow({ entry }: Props) {
  const t = useTranslations('audit');
  const format = useFormatter();
  const [open, setOpen] = useState(false);

  const actorLabel = entry.actorUsername
    ? entry.actorUsername
    : entry.actorType === 'system'
      ? t('actorSystem')
      : entry.actorType === 'ai'
        ? t('actorAi')
        : t('actorUnknown');

  return (
    <li className="border-b last:border-b-0" data-testid={`audit-entry-${entry.id}`}>
      <div className="grid gap-1 px-2 py-2 sm:grid-cols-[10rem_1fr_auto]">
        <span
          className="text-muted-foreground text-xs"
          data-testid={`audit-entry-${entry.id}-time`}
          title={entry.createdAt}
        >
          {format.relativeTime(new Date(entry.createdAt))}
        </span>
        <span className="text-sm">
          <span className="font-medium">{actorLabel}</span>
          <span className="text-muted-foreground"> · </span>
          <code className="text-xs">{entry.action}</code>
          {entry.entity && (
            <>
              <span className="text-muted-foreground"> · </span>
              <span className="text-xs">{entry.entity}</span>
            </>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? t('collapse') : t('expand')}
          data-testid={`audit-entry-${entry.id}-toggle-button`}
        >
          {open ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
      {open && (
        <div className="bg-muted/40 grid gap-2 p-3 text-xs sm:grid-cols-2">
          <Snapshot
            label={t('oldData')}
            value={entry.oldData}
            testId={`audit-entry-${entry.id}-old-data`}
          />
          <Snapshot
            label={t('newData')}
            value={entry.newData}
            testId={`audit-entry-${entry.id}-new-data`}
          />
        </div>
      )}
    </li>
  );
}

function Snapshot({ label, value, testId }: { label: string; value: unknown; testId: string }) {
  if (value === null || value === undefined) {
    return (
      <div className="grid gap-1">
        <span className="text-muted-foreground tracking-wide uppercase">{label}</span>
        <span className="text-muted-foreground italic">—</span>
      </div>
    );
  }
  return (
    <div className="grid gap-1" data-testid={testId}>
      <span className="text-muted-foreground tracking-wide uppercase">{label}</span>
      <pre className={cn('bg-background overflow-x-auto rounded border p-2 text-[11px]')}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
