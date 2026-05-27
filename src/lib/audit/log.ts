import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/types/database';

type AuditActorType = Database['public']['Enums']['audit_actor_type'];

export interface LogAuditInput {
  familyId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  action: string; // e.g. 'invite_link.generated'
  entity: string; // e.g. 'invite_links'
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}

/**
 * Append a row to public.audit_log. Uses the service-role client because some
 * audit events (invite acceptance, system-emitted entries) happen before the
 * acting user's session is fully established. Audit writes never throw — a
 * logging failure must not break the user action that triggered it.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('audit_log').insert({
      family_id: input.familyId ?? null,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      old_data: (input.oldData as never) ?? null,
      new_data: (input.newData as never) ?? null,
    });
  } catch (err) {
    console.error('[audit] write failed:', err);
  }
}
