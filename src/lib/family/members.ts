export type FamilyRole = 'owner' | 'member';

export interface FamilyMemberSummary {
  userId: string;
  username: string;
  role: FamilyRole;
}

/**
 * Owner first, then members, alphabetically by username within each group.
 *
 * The alphabetical tiebreak matters: `family_members` has no ordering column
 * that reflects anything a reader cares about, so without it the list would
 * reshuffle between page loads as Postgres returned rows in whatever order it
 * liked. Sorts a copy — callers may be rendering the input elsewhere.
 */
export function sortFamilyMembers<T extends FamilyMemberSummary>(members: T[]): T[] {
  const rank = (role: FamilyRole) => (role === 'owner' ? 0 : 1);
  return [...members].sort(
    (a, b) =>
      rank(a.role) - rank(b.role) ||
      a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }),
  );
}
