import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

// Single, hardcoded super-admin email. Mirrored in the DB trigger created by
// migration `20260527120000_super_admin.sql` — keep them in sync.
//
// Only this user can hold `users.role = 'admin'`, and only one such row is
// ever permitted (enforced by the trigger). Everyone else stays at 'user'.
export const SUPER_ADMIN_EMAIL = 'malbaski.ns@gmail.com';

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

/**
 * Promote the super-admin user to `role = 'admin'` if their profile is still
 * at the default `'user'`. Idempotent and safe to call after every login or
 * signup of the matching email — the DB trigger guarantees no other user can
 * ever sneak through this path.
 */
export async function ensureSuperAdmin(params: {
  userId: string;
  email: string | null | undefined;
}): Promise<void> {
  if (!isSuperAdminEmail(params.email)) return;

  const supabase = createServiceClient();
  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', params.userId)
    .maybeSingle();
  if (error || !profile) return;
  if (profile.role === 'admin') return;

  const { error: updateError } = await supabase
    .from('users')
    .update({ role: 'admin' })
    .eq('id', params.userId);
  if (updateError) {
    // Don't break login if the promotion fails; the user can still sign in.
    console.error('[super-admin] promotion failed:', updateError.message);
  }
}
