import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SignUpForm } from '@/components/auth/signup-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SignUpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('signUp.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('signUp.subtitle')}</p>
      </header>
      <SignUpForm />
      <p className="text-muted-foreground text-sm">
        {t('signUp.haveAccount')}{' '}
        <Link
          href="/login"
          className="underline-offset-4 hover:underline"
          data-testid="signup-page-login-link"
        >
          {t('signUp.loginLink')}
        </Link>
      </p>
    </div>
  );
}
