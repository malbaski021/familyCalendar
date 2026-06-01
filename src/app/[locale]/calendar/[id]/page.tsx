import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { redirect, Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';
import { DeleteEventButton } from '@/components/calendar/delete-event-button';
import type { EventCategory } from '@/lib/calendar/query';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EventDetailPage({ params }: Props) {
  const { locale, id } = await params;
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
      'id, title, category, start_date, end_date, start_time, end_time, location, notes, event_children(child_id, children(name))',
    )
    .eq('id', id)
    .eq('family_id', family.familyId)
    .maybeSingle();

  if (!event) notFound();

  const t = await getTranslations({ locale, namespace: 'events' });
  const tCat = await getTranslations({ locale, namespace: 'events.categories' });
  const style = CATEGORY_STYLES[event.category as EventCategory];
  const childNames = (event.event_children ?? [])
    .map((ec) => ec.children?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {style.emoji} {tCat(event.category as EventCategory)}
          </p>
          <h1
            className="text-2xl font-semibold tracking-tight"
            data-testid={`event-detail-title-${event.id}`}
          >
            {event.title}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/calendar/${event.id}/edit`} data-testid="event-detail-edit-link">
              {t('edit')}
            </Link>
          </Button>
          <DeleteEventButton eventId={event.id} />
        </div>
      </header>

      <dl className="grid gap-3 text-sm">
        <Row label={t('form.startDate')}>{event.start_date}</Row>
        {event.end_date && <Row label={t('form.endDate')}>{event.end_date}</Row>}
        {event.start_time && (
          <Row label={t('form.time')}>
            {event.start_time}
            {event.end_time && ` — ${event.end_time}`}
          </Row>
        )}
        {!event.start_time && <Row label={t('form.time')}>{t('form.allDay')}</Row>}
        {event.location && <Row label={t('form.location')}>{event.location}</Row>}
        {event.notes && <Row label={t('form.notes')}>{event.notes}</Row>}
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
