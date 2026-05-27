import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Service-role client — bypasses RLS. Use only on the server, and only for
// operations that legitimately need to run outside any user's session
// (e.g. validating an invite token before the user has signed up,
//  marking it consumed, inserting the matching `family_members` row).
//
// Never import this from client components.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Service-role Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
