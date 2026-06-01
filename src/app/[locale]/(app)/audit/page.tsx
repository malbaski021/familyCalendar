import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { loadAuditLog, type ActorFilter, type ActionFilter } from '@/lib/audit/query';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditEntryRow } from '@/components/audit/audit-entry-row';
import { AuditPagination } from '@/components/audit/audit-pagination';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    actor?: string;
    action?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: string;
  }>;
};

const ACTOR_VALUES = new Set<ActorFilter>(['all', 'me', 'others', 'ai', 'system']);
const ACTION_VALUES = new Set<ActionFilter>([
  'all',
  'created',
  'edited',
  'deleted',
  'notifications',
  'ai',
]);

function parseActor(v: string | undefined): ActorFilter {
  return v && ACTOR_VALUES.has(v as ActorFilter) ? (v as ActorFilter) : 'all';
}

function parseAction(v: string | undefined): ActionFilter {
  return v && ACTION_VALUES.has(v as ActionFilter) ? (v as ActionFilter) : 'all';
}

function parseIsoDate(v: string | undefined): string {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

export default async function AuditPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireOnboardedUser(locale);

  const filters = {
    actor: parseActor(sp.actor),
    action: parseAction(sp.action),
    from: parseIsoDate(sp.from),
    to: parseIsoDate(sp.to),
    q: sp.q?.trim() ?? '',
  };
  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const result = await loadAuditLog({
    actor: filters.actor,
    action: filters.action,
    from: filters.from || undefined,
    to: filters.to || undefined,
    q: filters.q || undefined,
    page,
  });

  const t = await getTranslations({ locale, namespace: 'audit' });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      <AuditFilters current={filters} />

      {result.entries.length === 0 ? (
        <div
          className="text-muted-foreground rounded-lg border p-12 text-center text-sm"
          data-testid="audit-empty"
        >
          {t('empty')}
        </div>
      ) : (
        <ul className="rounded-lg border" data-testid="audit-feed">
          {result.entries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      <AuditPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        searchParams={{
          actor: filters.actor === 'all' ? undefined : filters.actor,
          action: filters.action === 'all' ? undefined : filters.action,
          from: filters.from || undefined,
          to: filters.to || undefined,
          q: filters.q || undefined,
        }}
      />
    </div>
  );
}
