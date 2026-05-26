import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LoginView />;
}

function LoginView() {
  const tAuth = useTranslations('auth');

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-semibold tracking-tight">{tAuth('login')}</h1>
      <p className="text-muted-foreground mt-2">Placeholder — auth lands in F2.</p>
    </div>
  );
}
