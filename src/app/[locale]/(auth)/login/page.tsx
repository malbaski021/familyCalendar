import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LoginForm } from '@/components/auth/login-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('signIn.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('signIn.subtitle')}</p>
      </header>
      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
        <Link
          href="/forgot-password"
          className="underline-offset-4 hover:underline"
          data-testid="login-page-forgot-password-link"
        >
          {t('signIn.forgotPassword')}
        </Link>
        <p>
          {t('signIn.noAccount')}{' '}
          <Link
            href="/signup"
            className="underline-offset-4 hover:underline"
            data-testid="login-page-signup-link"
          >
            {t('signIn.signUpLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
