import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { CreateFamilyForm } from '@/components/admin/create-family-form';
import { InviteLinkCard } from '@/components/admin/invite-link-card';
import { sortFamilyMembers, type FamilyMemberSummary } from '@/lib/family/members';

type Props = {
  params: Promise<{ locale: string }>;
};

interface FamilyRow {
  id: string;
  name: string;
  slug: string;
  members: FamilyMemberSummary[];
}

async function loadFamilies(): Promise<FamilyRow[]> {
  const supabase = await createClient();
  // Pull the members themselves rather than a count — the admin needs to see
  // who is in a family, not just how many. The count is derived from the list
  // so the two can never disagree.
  const { data, error } = await supabase
    .from('families')
    .select('id, name, slug, family_members(user_id, role, users(username))')
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  return data.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    members: sortFamilyMembers(
      (f.family_members ?? []).map((m) => {
        // PostgREST types an embedded to-one relation as possibly an array.
        const profile = Array.isArray(m.users) ? m.users[0] : m.users;
        return {
          userId: m.user_id,
          username: profile?.username ?? m.user_id,
          role: m.role,
        };
      }),
    ),
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
                    {tFam('members')}: {family.members.length}
                  </p>
                </div>

                {family.members.length === 0 ? (
                  <p className="text-muted-foreground text-xs">{tFam('noMembers')}</p>
                ) : (
                  <ul
                    className="grid gap-1 border-t pt-3"
                    data-testid={`admin-family-${family.slug}-members`}
                  >
                    {family.members.map((member) => (
                      <li
                        key={member.userId}
                        className="flex items-baseline gap-2 text-sm"
                        data-testid={`admin-family-${family.slug}-member-${member.username}`}
                      >
                        <span>{member.username}</span>
                        <span className="text-muted-foreground text-xs">
                          ({tFam(member.role === 'owner' ? 'roleOwner' : 'roleMember')})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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
