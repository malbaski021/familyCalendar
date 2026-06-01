import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { TopNav } from '@/components/nav/top-nav';
import { BottomNav } from '@/components/nav/bottom-nav';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Shell for every signed-in surface (calendar, admin, settings, profile).
 * Renders the desktop top nav and the mobile bottom dock around the page
 * content so the user always has the primary shortcuts at hand.
 *
 * The onboarding wizard, auth flows, and the public invite-accept page all
 * live OUTSIDE this group on purpose — they need a focused single-task UI.
 */
export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }
  const isAdmin = user.profile.role === 'admin';

  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <TopNav isAdmin={isAdmin} />
      <main className="flex-1">{children}</main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
