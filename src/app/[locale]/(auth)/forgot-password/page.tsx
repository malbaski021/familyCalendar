import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ResetPasswordRequestForm } from '@/components/auth/reset-password-request-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('forgotPassword.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('forgotPassword.subtitle')}</p>
      </header>
      <ResetPasswordRequestForm />
      <Link
        href="/login"
        className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        data-testid="forgot-password-page-login-link"
      >
        {t('forgotPassword.backToLogin')}
      </Link>
    </div>
  );
}
