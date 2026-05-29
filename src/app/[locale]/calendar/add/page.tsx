import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireOnboardedUser } from '@/lib/auth/guards';

type Props = {
  params: Promise<{ locale: string }>;
};

// Event creation form is the heart of F6. Placeholder for now so the
// "Add" bottom-nav target still lands on something.
export default async function AddEventPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOnboardedUser(locale);
  const t = await getTranslations({ locale, namespace: 'calendar.addPlaceholder' });

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground text-sm">{t('body')}</p>
    </div>
  );
}
