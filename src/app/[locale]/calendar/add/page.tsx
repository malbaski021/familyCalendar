import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { EventForm } from '@/components/calendar/event-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AddEventPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);

  const family = await getFamilyContextFor(user.authId);
  if (!family) {
    redirect({ href: '/calendar', locale });
    return null;
  }

  const supabase = await createClient();
  const { data: children } = await supabase
    .from('children')
    .select('id, name')
    .eq('family_id', family.familyId)
    .order('created_at', { ascending: true });

  const t = await getTranslations({ locale, namespace: 'events' });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('createTitle')}</h1>
      </header>
      <EventForm mode="create" familyChildren={children ?? []} />
    </div>
  );
}
