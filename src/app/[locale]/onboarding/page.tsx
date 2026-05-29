import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  // Admin users (no family of their own) skip onboarding entirely.
  const family = await getFamilyContextFor(user.authId);
  if (!family) {
    redirect({ href: user.profile.role === 'admin' ? '/admin' : '/calendar', locale });
    return null;
  }

  const supabase = await createClient();
  const { data: children } = await supabase
    .from('children')
    .select('id, name')
    .eq('family_id', family.familyId)
    .order('created_at', { ascending: true });

  return <OnboardingShell initialChildren={children ?? []} username={user.profile.username} />;
}
