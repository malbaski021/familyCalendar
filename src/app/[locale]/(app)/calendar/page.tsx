import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { format } from 'date-fns';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { loadEventsInRange } from '@/lib/calendar/query';
import { formatDateParam, parseDate, parseView, rangeForView } from '@/lib/calendar/view';
import { CalendarNav } from '@/components/calendar/calendar-nav';
import { CalendarSkeleton } from '@/components/calendar/calendar-skeleton';
import { MonthView } from '@/components/calendar/month-view';
import { WeekView } from '@/components/calendar/week-view';
import { DayView } from '@/components/calendar/day-view';
import { RealtimeEvents } from '@/components/calendar/realtime-events';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
};

export default async function CalendarPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireOnboardedUser(locale);
  const sp = await searchParams;
  const view = parseView(sp.view);
  const anchor = parseDate(sp.date);
  const range = rangeForView(view, anchor);

  const family = await getFamilyContextFor(user.authId);
  const title = titleFor(view, anchor);

  return (
    <>
      <CalendarNav view={view} anchor={anchor} title={title} />
      {!family ? (
        <NoFamily locale={locale} />
      ) : (
        <>
          <RealtimeEvents familyId={family.familyId} />
          <Suspense fallback={<CalendarSkeleton />}>
            <CalendarBody view={view} anchor={anchor} range={range} familyId={family.familyId} />
          </Suspense>
        </>
      )}
    </>
  );
}

async function CalendarBody({
  view,
  anchor,
  range,
  familyId,
}: {
  view: 'month' | 'week' | 'day';
  anchor: Date;
  range: { start: Date; end: Date };
  familyId: string;
}) {
  const events = await loadEventsInRange(familyId, range);
  if (view === 'month') return <MonthView range={range} anchor={anchor} events={events} />;
  if (view === 'week') return <WeekView range={range} events={events} />;
  return <DayView dayKey={formatDateParam(anchor)} events={events} />;
}

async function NoFamily({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'calendar' });
  return (
    <div
      className="text-muted-foreground flex flex-col items-center gap-2 p-12 text-sm"
      data-testid="calendar-no-family"
    >
      <p>{t('noFamily')}</p>
    </div>
  );
}

function titleFor(view: 'month' | 'week' | 'day', anchor: Date): string {
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  if (view === 'day') return format(anchor, 'EEEE, MMM d');
  return `${format(anchor, 'MMM d')} – ${format(anchor, 'MMM d, yyyy')}`;
}
