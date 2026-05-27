import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { AcceptInviteForm } from '@/components/auth/accept-invite-form';
import { validateInvite, type InviteValidationError } from '@/lib/family/invites';

type Props = {
  params: Promise<{ locale: string; role: string; token: string }>;
};

const VALID_ROLES = new Set(['owner', 'member']);

const REASON_KEY: Record<InviteValidationError, string> = {
  used: 'errors.used',
  expired: 'errors.expired',
  revoked: 'errors.revoked',
  'not-found': 'errors.notFound',
};

export default async function InvitePage({ params }: Props) {
  const { locale, role, token } = await params;
  setRequestLocale(locale);

  if (!VALID_ROLES.has(role)) notFound();

  const t = await getTranslations({ locale, namespace: 'invite' });
  const validation = await validateInvite(token);

  if (!validation.ok) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('invalidTitle')}</h1>
          <p className="text-muted-foreground text-sm" data-testid="invite-error-message">
            {t(REASON_KEY[validation.reason])}
          </p>
        </header>
        <Button asChild variant="outline">
          <Link href="/login" data-testid="invite-error-login-link">
            {t('backToLogin')}
          </Link>
        </Button>
      </div>
    );
  }

  // Mismatched role between URL and stored invite → treat as 404 so URLs can't
  // be mutated to escalate privileges.
  if (validation.invite.role !== role) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('title', { family: validation.invite.family_name })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('subtitle', { role: t(`role.${validation.invite.role}`) })}
        </p>
      </header>
      <AcceptInviteForm token={token} />
    </div>
  );
}
