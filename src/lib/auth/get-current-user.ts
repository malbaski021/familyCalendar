import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type CurrentUser = {
  authId: string;
  email: string;
  profile: Database['public']['Tables']['users']['Row'];
};

/**
 * Returns the currently authenticated user with their public profile, or `null`
 * if no user is signed in. Cached per request (React `cache`) so multiple
 * server components in the same render don't trigger duplicate auth calls.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;

  return {
    authId: user.id,
    email: user.email ?? '',
    profile,
  };
});

/**
 * Throws if the user is not signed in. Use in server components / route
 * handlers under protected routes — the proxy middleware should have
 * redirected unauthenticated requests already, so this is a safety net.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
}
