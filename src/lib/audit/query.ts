import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type ActorFilter = 'all' | 'me' | 'others' | 'ai' | 'system';
export type ActionFilter = 'all' | 'created' | 'edited' | 'deleted' | 'notifications' | 'ai';
export type AuditActorType = Database['public']['Enums']['audit_actor_type'];

export interface AuditEntry {
  id: string;
  actorType: AuditActorType;
  actorId: string | null;
  actorUsername: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldData: unknown;
  newData: unknown;
  createdAt: string;
}

export interface AuditQuery {
  actor?: ActorFilter;
  action?: ActionFilter;
  /** ISO YYYY-MM-DD (inclusive). */
  from?: string;
  /** ISO YYYY-MM-DD (inclusive). */
  to?: string;
  q?: string;
  page?: number;
}

export const PAGE_SIZE = 50;

/**
 * Map the UI filter buckets to the action-name prefixes/suffixes we actually
 * write. Lives next to the loader so the query and the filter chip labels
 * stay in lockstep.
 */
const ACTION_GROUPS: Record<Exclude<ActionFilter, 'all'>, string[]> = {
  // Anything that creates a new row: `*.created`, `*.added`, `*.generated`, `*.acquired`.
  created: ['.created', '.added', '.generated', '.lock_acquired', '.saved'],
  // Edits, renames, regenerations, lock refreshes, single-occurrence overrides.
  edited: ['.updated', '.renamed', '.regenerated', 'event_instance.updated'],
  // Hard or soft deletions, cancellations, revocations, lock releases.
  deleted: ['.deleted', '.removed', '.revoked', '.cancelled', '.discarded', '.lock_released'],
  notifications: ['notification.', 'push.'],
  ai: ['ai.', 'agent.'],
};

/**
 * Load a page of audit entries for the caller. RLS does the family-scoping
 * (admin reads everything, members read only their own family). Search and
 * action-group filters happen server-side via `ilike`/`or`; date and actor
 * filters use indexed columns directly.
 */
export async function loadAuditLog(
  query: AuditQuery,
): Promise<{ entries: AuditEntry[]; total: number; page: number; pageSize: number }> {
  const supabase = await createClient();
  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Get the calling user up front so the "me" / "others" buckets resolve correctly.
  const { data: auth } = await supabase.auth.getUser();
  const callerId = auth.user?.id ?? null;

  let request = supabase
    .from('audit_log')
    .select(
      'id, family_id, actor_type, actor_id, action, entity, entity_id, old_data, new_data, created_at, users:users!audit_log_actor_id_fkey(username)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  // Actor filter — translates to SQL where clauses.
  if (query.actor === 'me' && callerId) request = request.eq('actor_id', callerId);
  if (query.actor === 'others' && callerId) {
    request = request.neq('actor_id', callerId).not('actor_id', 'is', null);
  }
  if (query.actor === 'ai') request = request.eq('actor_type', 'ai');
  if (query.actor === 'system') request = request.eq('actor_type', 'system');

  // Action group filter — match any of the configured prefixes/suffixes.
  if (query.action && query.action !== 'all') {
    const fragments = ACTION_GROUPS[query.action];
    const orClause = fragments.map((f) => `action.ilike.%${f}%`).join(',');
    request = request.or(orClause);
  }

  // Date range — inclusive on both ends.
  if (query.from) request = request.gte('created_at', `${query.from}T00:00:00Z`);
  if (query.to) request = request.lte('created_at', `${query.to}T23:59:59Z`);

  // Full-text-ish search across the action and entity columns. Light by design.
  if (query.q && query.q.trim().length > 0) {
    const q = `%${query.q.trim()}%`;
    request = request.or(`action.ilike.${q},entity.ilike.${q},entity_id.ilike.${q}`);
  }

  request = request.range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error } = await request;
  if (error || !data) return { entries: [], total: 0, page, pageSize: PAGE_SIZE };

  const entries: AuditEntry[] = data.map((row) => ({
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    actorUsername: Array.isArray(row.users)
      ? (row.users[0]?.username ?? null)
      : ((row.users as { username: string } | null)?.username ?? null),
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    oldData: row.old_data,
    newData: row.new_data,
    createdAt: row.created_at,
  }));

  return { entries, total: count ?? 0, page, pageSize: PAGE_SIZE };
}
