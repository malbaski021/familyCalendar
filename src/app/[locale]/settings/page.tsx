import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { InviteLinkCard } from '@/components/admin/invite-link-card';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: 'settings' });
  const tMembers = await getTranslations({ locale, namespace: 'settings.members' });

  const supabase = await createClient();
  const { data: ownerMembership } = await supabase
    .from('family_members')
    .select('family_id, families!inner(name, slug)')
    .eq('user_id', user.authId)
    .eq('role', 'owner')
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{tMembers('heading')}</h2>
        {!ownerMembership ? (
          <p className="text-muted-foreground text-sm">{tMembers('noFamily')}</p>
        ) : (
          <div className="grid gap-3 rounded-lg border p-4">
            <p className="font-medium">{ownerMembership.families.name}</p>
            <InviteLinkCard
              familyId={ownerMembership.family_id}
              mode="member"
              testIdPrefix={`settings-family-${ownerMembership.families.slug}`}
            />
          </div>
        )}
      </section>
    </div>
  );
}
