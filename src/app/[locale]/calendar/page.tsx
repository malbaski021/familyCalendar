import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CalendarView />;
}

function CalendarView() {
  const tNav = useTranslations('nav');

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-semibold tracking-tight">{tNav('calendar')}</h1>
      <p className="text-muted-foreground mt-2">Placeholder — calendar views land in F5.</p>
    </div>
  );
}
