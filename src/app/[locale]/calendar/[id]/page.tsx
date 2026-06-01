import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { redirect, Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import { DeleteEventButton } from '@/components/calendar/delete-event-button';
import { CancelInstanceButton } from '@/components/calendar/cancel-instance-button';
import type { EventCategory } from '@/lib/calendar/query';

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ date?: string }>;
};

export default async function EventDetailPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);

  const family = await getFamilyContextFor(user.authId);
  if (!family) {
    redirect({ href: '/calendar', locale });
    return null;
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select(
      'id, title, category, start_date, end_date, start_time, end_time, location, notes, recurring_pattern, recurring_end_date, event_children(child_id, children(name))',
    )
    .eq('id', id)
    .eq('family_id', family.familyId)
    .maybeSingle();

  if (!event) notFound();

  const isRecurring = event.recurring_pattern !== null;
  const instanceDate =
    isRecurring && sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;

  // For a recurring occurrence, pull the matching override (if any) so the
  // detail screen shows the per-instance values instead of the master values.
  let override: {
    override_title: string | null;
    override_start_time: string | null;
    override_end_time: string | null;
    override_location: string | null;
    override_notes: string | null;
  } | null = null;
  if (instanceDate) {
    const { data: instanceRow } = await supabase
      .from('event_instances')
      .select(
        'override_title, override_start_time, override_end_time, override_location, override_notes',
      )
      .eq('event_id', event.id)
      .eq('instance_date', instanceDate)
      .maybeSingle();
    override = instanceRow ?? null;
  }

  const t = await getTranslations({ locale, namespace: 'events' });
  const tCat = await getTranslations({ locale, namespace: 'events.categories' });
  const style = CATEGORY_STYLES[event.category as EventCategory];
  const childNames = (event.event_children ?? [])
    .map((ec) => ec.children?.name)
    .filter((n): n is string => Boolean(n));

  const displayTitle = override?.override_title ?? event.title;
  const displayStartTime = override?.override_start_time ?? event.start_time;
  const displayEndTime = override?.override_end_time ?? event.end_time;
  const displayLocation = override?.override_location ?? event.location;
  const displayNotes = override?.override_notes ?? event.notes;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-muted-foreground flex items-center gap-2 text-xs tracking-wide uppercase">
            <span>
              {style.emoji} {tCat(event.category as EventCategory)}
            </span>
            {isRecurring && (
              <span className="rounded-full border px-2 py-0.5 text-[10px]">
                {t('seriesBadge')}
              </span>
            )}
          </p>
          <h1
            className="text-2xl font-semibold tracking-tight"
            data-testid={`event-detail-title-${event.id}`}
          >
            {displayTitle}
          </h1>
          {instanceDate && <p className="text-muted-foreground text-xs">{instanceDate}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {instanceDate ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/calendar/${event.id}/instance/${instanceDate}/edit`}
                  data-testid="event-detail-edit-instance-link"
                >
                  {t('instance.editOccurrence')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/calendar/${event.id}/edit`}
                  data-testid="event-detail-edit-series-link"
                >
                  {t('instance.editSeries')}
                </Link>
              </Button>
              <CancelInstanceButton eventId={event.id} instanceDate={instanceDate} />
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/calendar/${event.id}/edit`} data-testid="event-detail-edit-link">
                  {t('edit')}
                </Link>
              </Button>
              <DeleteEventButton eventId={event.id} />
            </>
          )}
        </div>
      </header>

      <dl className="grid gap-3 text-sm">
        <Row label={t('form.startDate')}>{instanceDate ?? event.start_date}</Row>
        {!instanceDate && event.end_date && <Row label={t('form.endDate')}>{event.end_date}</Row>}
        {displayStartTime && (
          <Row label={t('form.time')}>
            {displayStartTime}
            {displayEndTime && ` — ${displayEndTime}`}
          </Row>
        )}
        {!displayStartTime && <Row label={t('form.time')}>{t('form.allDay')}</Row>}
        {isRecurring && !instanceDate && (
          <Row label={t('form.recurrence')}>
            {t(`form.recurrence${capitalise(event.recurring_pattern!)}`)}
            {event.recurring_end_date && ` → ${event.recurring_end_date}`}
          </Row>
        )}
        {displayLocation && <Row label={t('form.location')}>{displayLocation}</Row>}
        {displayNotes && <Row label={t('form.notes')}>{displayNotes}</Row>}
        {childNames.length > 0 && <Row label={t('form.children')}>{childNames.join(', ')}</Row>}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 border-b py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
