import { ChevronRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { CreateFamilyForm } from '@/components/admin/create-family-form';
import { DeleteFamilyDialog } from '@/components/admin/delete-family-dialog';
import { InviteLinkCard } from '@/components/admin/invite-link-card';
import {
  buildFamilyRoster,
  sortFamilyMembers,
  type FamilyMemberSummary,
} from '@/lib/family/members';

type Props = {
  params: Promise<{ locale: string }>;
};

interface FamilyChild {
  id: string;
  name: string;
}

interface FamilyRow {
  id: string;
  name: string;
  slug: string;
  members: FamilyMemberSummary[];
  children: FamilyChild[];
}

async function loadFamilies(): Promise<FamilyRow[]> {
  const supabase = await createClient();
  // Pull the members themselves rather than a count — the admin needs to see
  // who is in a family, not just how many. The count is derived from the list
  // so the two can never disagree.
  const { data, error } = await supabase
    .from('families')
    .select('id, name, slug, family_members(user_id, role, users(username)), children(id, name)')
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
    // Sorted by name so the list doesn't reshuffle between page loads.
    children: [...(f.children ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
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
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{family.name}</p>
                  <DeleteFamilyDialog
                    familyId={family.id}
                    familyName={family.name}
                    memberCount={family.members.length}
                    testIdPrefix={`admin-family-${family.slug}`}
                  />
                </div>

                {(() => {
                  const roster = buildFamilyRoster(family.members, family.children);
                  if (roster.length === 0) {
                    return (
                      <p className="text-muted-foreground border-t pt-3 text-xs">
                        {tFam('noMembers')}
                      </p>
                    );
                  }
                  return (
                    // Native <details> so the toggle needs no client component
                    // and works before hydration. Collapsed by default.
                    <details
                      className="group border-t pt-3"
                      data-testid={`admin-family-${family.slug}-details`}
                    >
                      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-xs select-none">
                        <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                        {tFam('details')}
                      </summary>

                      {/* The <ul> owns the column tracks and each <li> inherits
                          them via subgrid, so the roles line up across rows
                          instead of each row sizing itself. */}
                      <ul className="mt-2 grid grid-cols-[max-content_max-content] gap-x-3 gap-y-1 pl-[1.125rem]">
                        {roster.map((entry) => (
                          <li
                            key={entry.key}
                            className="col-span-2 grid grid-cols-subgrid items-baseline"
                            data-testid={`admin-family-${family.slug}-roster-${entry.key}`}
                          >
                            <span className="text-sm">{entry.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({tFam(`role.${entry.role}`)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })()}

                {/* An owner invite only makes sense while the seat is empty —
                    once someone has claimed it, the button is dead weight. */}
                {family.members.some((m) => m.role === 'owner') ? null : (
                  <InviteLinkCard
                    familyId={family.id}
                    mode="owner"
                    testIdPrefix={`admin-family-${family.slug}`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
