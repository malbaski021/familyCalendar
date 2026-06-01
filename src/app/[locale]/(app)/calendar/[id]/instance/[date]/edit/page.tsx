import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { InstanceOverrideForm } from '@/components/calendar/instance-override-form';
import { BackLink } from '@/components/nav/back-link';

type Props = {
  params: Promise<{ locale: string; id: string; date: string }>;
};

export default async function EditInstancePage({ params }: Props) {
  const { locale, id, date } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const family = await getFamilyContextFor(user.authId);
  if (!family) {
    redirect({ href: '/calendar', locale });
    return null;
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, title, start_time, end_time, location, notes, recurring_pattern, family_id')
    .eq('id', id)
    .eq('family_id', family.familyId)
    .maybeSingle();
  if (!event || event.recurring_pattern === null) notFound();

  const { data: instance } = await supabase
    .from('event_instances')
    .select(
      'override_title, override_start_time, override_end_time, override_location, override_notes',
    )
    .eq('event_id', id)
    .eq('instance_date', date)
    .maybeSingle();

  const t = await getTranslations({ locale, namespace: 'events.instance' });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      <BackLink
        href={`/calendar/${event.id}?date=${date}`}
        label={event.title}
        data-testid="instance-edit-back-link"
      />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('editTitle')}</h1>
        <p className="text-muted-foreground text-sm">{date}</p>
      </header>
      <InstanceOverrideForm
        eventId={event.id}
        instanceDate={date}
        initial={{
          title: instance?.override_title ?? event.title,
          startTime: trimTime(instance?.override_start_time ?? event.start_time),
          endTime: trimTime(instance?.override_end_time ?? event.end_time),
          location: instance?.override_location ?? event.location,
          notes: instance?.override_notes ?? event.notes,
        }}
      />
    </div>
  );
}

function trimTime(value: string | null): string | null {
  if (!value) return null;
  return value.length >= 5 ? value.slice(0, 5) : value;
}
