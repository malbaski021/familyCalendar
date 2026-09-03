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
    // `h-dvh` rather than `min-h-screen`: a page can only divide the leftover
    // space evenly (the month grid does) if the shell has a definite height,
    // and dvh tracks the mobile URL bar where vh does not. Scrolling moves
    // into <main>, so tall pages still scroll while short ones stop guessing.
    //
    // Both navs are ordinary flex children, so the column measures them and
    // <main> gets exactly what is left — no reserved padding to keep in sync
    // with a nav's real height, and therefore no gap when the two disagree.
    <div className="flex h-dvh flex-col">
      <TopNav isAdmin={isAdmin} />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
