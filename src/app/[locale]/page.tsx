import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentUser } from '@/lib/auth/get-current-user';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Signed-in visitors skip the marketing splash and land straight in the app.
  const user = await getCurrentUser();
  if (user) {
    redirect({ href: '/calendar', locale });
  }

  return <Home />;
}

function Home() {
  const t = useTranslations('home');
  const tAuth = useTranslations('auth');

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <main className="flex max-w-2xl flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('welcome')}</h1>
        <p className="text-muted-foreground text-lg">{t('subtitle')}</p>
        <div className="mt-4">
          <Button asChild data-testid="home-login-button">
            <Link href="/login">{tAuth('login')}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
