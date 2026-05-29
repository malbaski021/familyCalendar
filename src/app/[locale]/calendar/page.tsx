import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { requireOnboardedUser } from '@/lib/auth/guards';
import { LogoutButton } from '@/components/auth/logout-button';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireOnboardedUser(locale);
  return <CalendarView username={user.profile.username} />;
}

function CalendarView({ username }: { username: string }) {
  const tNav = useTranslations('nav');

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <header className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{tNav('calendar')}</h1>
        <LogoutButton />
      </header>
      <p className="text-muted-foreground">
        Signed in as <span className="font-medium">{username}</span>. Placeholder — calendar views
        land in F5.
      </p>
    </div>
  );
}
