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

/**
 * Everyone in a family as one list: accounts and children together.
 *
 * `child` is not a `family_member_role` — children live in their own table and
 * have no login. They are folded in here purely for display, because "who is
 * in this family" is one question, not two.
 */
export type RosterRole = FamilyRole | 'child';

export interface RosterEntry {
  /** Stable React key; ids can collide across the two source tables. */
  key: string;
  name: string;
  role: RosterRole;
}

export function buildFamilyRoster(
  members: FamilyMemberSummary[],
  children: { id: string; name: string }[],
): RosterEntry[] {
  const rank: Record<RosterRole, number> = { owner: 0, member: 1, child: 2 };
  const entries: RosterEntry[] = [
    ...members.map((m) => ({ key: `user-${m.userId}`, name: m.username, role: m.role })),
    ...children.map((c) => ({ key: `child-${c.id}`, name: c.name, role: 'child' as const })),
  ];
  return entries.sort(
    (a, b) =>
      rank[a.role] - rank[b.role] ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}
