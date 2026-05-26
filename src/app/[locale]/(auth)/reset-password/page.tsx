import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewPasswordForm } from '@/components/auth/new-password-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('resetPassword.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('resetPassword.subtitle')}</p>
      </header>
      <NewPasswordForm />
    </div>
  );
}
