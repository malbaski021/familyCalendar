import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { EventForm } from '@/components/calendar/event-form';
import { BackLink } from '@/components/nav/back-link';
import type { EventCategory } from '@/lib/calendar/query';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EditEventPage({ params }: Props) {
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
      'id, title, category, start_date, end_date, start_time, end_time, location, notes, recurring_pattern, recurring_end_date, event_children(child_id)',
    )
    .eq('id', id)
    .eq('family_id', family.familyId)
    .maybeSingle();

  if (!event) notFound();

  const { data: children } = await supabase
    .from('children')
    .select('id, name')
    .eq('family_id', family.familyId)
    .order('created_at', { ascending: true });

  const t = await getTranslations({ locale, namespace: 'events' });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      <BackLink
        href={`/calendar/${event.id}`}
        label={event.title}
        data-testid="edit-event-back-link"
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('editTitle')}</h1>
      </header>
      <EventForm
        mode="edit"
        eventId={event.id}
        initial={{
          title: event.title,
          category: event.category as EventCategory,
          startDate: event.start_date,
          endDate: event.end_date,
          startTime: event.start_time ? event.start_time.slice(0, 5) : null,
          endTime: event.end_time ? event.end_time.slice(0, 5) : null,
          location: event.location,
          notes: event.notes,
          allDay: !event.start_time,
          childIds: (event.event_children ?? []).map((ec) => ec.child_id),
          recurrence: event.recurring_pattern ?? 'none',
          recurringEndDate: event.recurring_end_date,
        }}
        familyChildren={children ?? []}
      />
    </div>
  );
}
