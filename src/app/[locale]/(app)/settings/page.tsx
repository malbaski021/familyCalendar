import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { InviteLinkCard } from '@/components/admin/invite-link-card';
import { ChildrenManager } from '@/components/family/children-manager';
import { RelaunchOnboardingButton } from '@/components/onboarding/relaunch-button';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireOnboardedUser(locale);

  const t = await getTranslations({ locale, namespace: 'settings' });
  const tMembers = await getTranslations({ locale, namespace: 'settings.members' });
  const tChildren = await getTranslations({ locale, namespace: 'settings.childrenSection' });
  const tOnboarding = await getTranslations({ locale, namespace: 'settings.onboarding' });

  const family = await getFamilyContextFor(user.authId);

  const supabase = await createClient();
  const { data: children } = family
    ? await supabase
        .from('children')
        .select('id, name')
        .eq('family_id', family.familyId)
        .order('created_at', { ascending: true })
    : { data: [] };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{tMembers('heading')}</h2>
        {!family || family.role !== 'owner' ? (
          <p className="text-muted-foreground text-sm">{tMembers('noFamily')}</p>
        ) : (
          <div className="grid gap-3 rounded-lg border p-4">
            <p className="font-medium">{family.familyName}</p>
            <InviteLinkCard
              familyId={family.familyId}
              mode="member"
              testIdPrefix={`settings-family-${family.familySlug}`}
            />
          </div>
        )}
      </section>

      {family && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{tChildren('heading')}</h2>
          <ChildrenManager initial={children ?? []} testIdPrefix="settings-children" />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{tOnboarding('heading')}</h2>
        <p className="text-muted-foreground text-sm">{tOnboarding('description')}</p>
        <RelaunchOnboardingButton />
      </section>
    </div>
  );
}
