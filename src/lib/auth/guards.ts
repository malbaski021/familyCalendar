import 'server-only';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/get-current-user';
import { getFamilyContextFor } from '@/lib/family/get-family-context';

/**
 * Page-level guard. Returns the current user. If the user is logged in but
 * still owes onboarding (member of a family with `users.onboarded_at IS NULL`),
 * redirects to `/onboarding` instead of returning. Admins and users without a
 * family yet pass through unaffected.
 */
export async function requireOnboardedUser(locale: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
    throw new Error('unreachable');
  }

  // Admin users do not have a family of their own — they don't onboard.
  if (user.profile.role === 'admin') return user;

  // Users with no family membership (post-signup edge case) skip onboarding too.
  const family = await getFamilyContextFor(user.authId);
  if (!family) return user;

  if (user.profile.onboarded_at == null) {
    redirect({ href: '/onboarding', locale });
    throw new Error('unreachable');
  }

  return user;
}
