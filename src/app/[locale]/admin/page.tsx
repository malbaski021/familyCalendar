import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { CreateFamilyForm } from '@/components/admin/create-family-form';
import { InviteLinkCard } from '@/components/admin/invite-link-card';

type Props = {
  params: Promise<{ locale: string }>;
};

interface FamilyRow {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
}

async function loadFamilies(): Promise<FamilyRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('families')
    .select('id, name, slug, family_members(count)')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    memberCount: f.family_members?.[0]?.count ?? 0,
  }));
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }
  if (user.profile.role !== 'admin') {
    redirect({ href: '/calendar', locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: 'admin' });
  const tFam = await getTranslations({ locale, namespace: 'admin.families' });
  const families = await loadFamilies();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t('createFamily.submit')}</h2>
        <CreateFamilyForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{tFam('heading')}</h2>
        {families.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tFam('empty')}</p>
        ) : (
          <ul className="grid gap-4">
            {families.map((family) => (
              <li key={family.id} className="grid gap-3 rounded-lg border p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="font-medium">{family.name}</p>
                    <p className="text-muted-foreground text-xs">{family.slug}</p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {tFam('members')}: {family.memberCount}
                  </p>
                </div>
                <InviteLinkCard
                  familyId={family.id}
                  mode="owner"
                  testIdPrefix={`admin-family-${family.slug}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
