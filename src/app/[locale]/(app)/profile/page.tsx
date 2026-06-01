import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireOnboardedUser } from '@/lib/auth/guards';

type Props = {
  params: Promise<{ locale: string }>;
};

// Profile lands in a later phase. Until then it just bounces to Settings
// where Children + invites + relaunch already live.
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOnboardedUser(locale);
  redirect({ href: '/settings', locale });
  return null;
}
