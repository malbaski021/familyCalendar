import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit/log';
import { sendPush } from '@/lib/notifications/web-push';
import { callGroq } from '@/lib/ai/groq-client';
import { orchestrate } from '@/lib/ai/orchestrate';
import { buildQueuePayload, parseQueuePayload } from '@/lib/ai/queue-payload';
import type { AiSuggestionInput } from '@/lib/ai/schemas';
import type { GroqCall } from '@/lib/ai/types';

// Background half of the AI path. The synchronous attempt in `orchestrate`
// gives up after 3s so the save is never blocked; whatever it could not finish
// lands here and is retried out of band.
//
// Every write goes through the service-role client: `ai_queue` deliberately has
// no user UPDATE policy (see migration 20260526140800), because status is a
// lifecycle the server owns, not something a client may set.

export interface EnqueueParams {
  eventId: string;
  familyId: string;
  requestedBy: string;
  input: AiSuggestionInput;
  /** Why the sync path gave up — stored and audited. */
  reason: string;
}

/**
 * Park an AI request for background processing. Never throws: a queue failure
 * must not surface to a user who has already successfully saved their event.
 */
export async function enqueueAiTask(params: EnqueueParams): Promise<{ id: string } | null> {
  try {
    const supabase = createServiceClient();
    const payload = buildQueuePayload({
      requestedBy: params.requestedBy,
      familyId: params.familyId,
      reason: params.reason,
      input: params.input,
    });

    const { data, error } = await supabase
      .from('ai_queue')
      .insert({
        event_id: params.eventId,
        tasks: payload as never,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[ai_queue] enqueue failed:', error?.message);
      return null;
    }

    await logAudit({
      familyId: params.familyId,
      actorType: 'system',
      actorId: params.requestedBy,
      action: 'ai.queued',
      entity: 'ai_queue',
      entityId: data.id,
      newData: { eventId: params.eventId, reason: params.reason },
    });

    return { id: data.id };
  } catch (err) {
    console.error('[ai_queue] enqueue threw:', err);
    return null;
  }
}

/**
 * Take ownership of a pending task.
 *
 * The `eq('status', 'pending')` predicate is the whole duplicate-processing
 * guard: the UPDATE is atomic, so of two workers racing the same row — a
 * realtime handler in two open tabs, or a tab and the retry cron — exactly one
 * gets a row back and the other gets null. Nothing is processed twice.
 */
export async function claimTask(taskId: string): Promise<{
  id: string;
  eventId: string;
  tasks: unknown;
  attempts: number;
} | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_queue')
    .update({ status: 'processing' })
    .eq('id', taskId)
    .eq('status', 'pending')
    .select('id, event_id, tasks, attempts')
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id, eventId: data.event_id, tasks: data.tasks, attempts: data.attempts };
}

export type ProcessOutcome =
  | { status: 'done'; taskId: string }
  | { status: 'failed'; taskId: string; error: string }
  | { status: 'skipped'; reason: 'already-claimed' };

export interface ProcessDeps {
  /** Injectable so integration tests can run the lifecycle without a Groq key. */
  call?: GroqCall;
  /** Set false in tests that don't want a push attempt. */
  notify?: boolean;
}

/**
 * Claim, run and settle one queued task. Returns rather than throws so a
 * caller draining the queue can keep going past a bad row.
 */
export async function processQueuedTask(
  taskId: string,
  deps: ProcessDeps = {},
): Promise<ProcessOutcome> {
  const claimed = await claimTask(taskId);
  if (!claimed) return { status: 'skipped', reason: 'already-claimed' };

  const supabase = createServiceClient();
  const parsed = parseQueuePayload(claimed.tasks);

  if (!parsed.ok) {
    // Unreadable payload will never become readable — fail it rather than
    // leaving it to be retried forever.
    return settleFailed(taskId, claimed.attempts, `bad payload: ${parsed.error}`);
  }

  const payload = parsed.payload;
  const outcome = await orchestrate(payload.input, { call: deps.call ?? callGroq });

  if (outcome.status !== 'ready') {
    return settleFailed(
      taskId,
      claimed.attempts,
      `${outcome.status}: ${outcome.reason}`,
      payload.familyId,
      claimed.eventId,
    );
  }

  const { error } = await supabase
    .from('ai_queue')
    .update({
      status: 'done',
      result: outcome.suggestions as never,
      error: null,
      attempts: claimed.attempts + 1,
      processed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    return { status: 'failed', taskId, error: error.message };
  }

  await logAudit({
    familyId: payload.familyId,
    actorType: 'ai',
    actorId: null,
    action: 'ai.completed',
    entity: 'ai_queue',
    entityId: taskId,
    newData: {
      category: outcome.suggestions.categorization.category,
      isDuplicate: outcome.suggestions.duplicates.isDuplicate,
    },
  });

  if (deps.notify !== false) {
    // Best effort — the work is already recorded as done, and a failed push
    // must not flip the row back to failed.
    try {
      await sendPush({
        userId: payload.requestedBy,
        type: 'ai_complete',
        eventId: claimed.eventId,
        payload: {
          title: 'Suggestions ready',
          body: outcome.suggestions.userMessage,
          url: `/calendar/${claimed.eventId}`,
          tag: `ai-${taskId}`,
        },
      });
    } catch (err) {
      console.error('[ai_queue] push after completion failed:', err);
    }
  }

  return { status: 'done', taskId };
}

async function settleFailed(
  taskId: string,
  attempts: number,
  message: string,
  familyId?: string,
  eventId?: string,
): Promise<ProcessOutcome> {
  const supabase = createServiceClient();
  await supabase
    .from('ai_queue')
    .update({
      status: 'failed',
      error: message,
      attempts: attempts + 1,
      processed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  await logAudit({
    familyId: familyId ?? null,
    actorType: 'system',
    actorId: null,
    action: 'ai.failed',
    entity: 'ai_queue',
    entityId: taskId,
    newData: { error: message, eventId: eventId ?? null },
  });

  return { status: 'failed', taskId, error: message };
}

/** Oldest pending tasks first — used by the realtime handler and the F17 cron. */
export async function listPendingTasks(limit = 10): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_queue')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => row.id);
}
