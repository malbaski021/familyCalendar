import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface FamilyContext {
  familyId: string;
  familyName: string;
  familySlug: string;
  role: 'owner' | 'member';
}

/**
 * Look up the single family the current user belongs to. Returns null for
 * users who are not yet members of any family — e.g. the super admin or
 * someone in the brief window between auth signup and invite consumption.
 *
 * Users are expected to belong to at most one family in v1; this helper
 * therefore picks the first row deterministically (oldest membership).
 */
export async function getFamilyContextFor(userId: string): Promise<FamilyContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('family_members')
    .select('role, family_id, families!inner(name, slug)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    familyId: data.family_id,
    familyName: data.families.name,
    familySlug: data.families.slug,
    role: data.role,
  };
}
