import { z } from 'zod';
import type { AiSuggestionInput } from '@/lib/ai/schemas';

// `ai_queue.tasks` is a free-form jsonb column, so this is the contract that
// keeps a queued row self-contained: a background worker must be able to redo
// the request without re-deriving the family context that produced it.
//
// `requestedBy` lives here rather than in a column because `ai_queue` has no
// `user_id` — and the queue needs it to know whom to notify on completion.

export const QUEUE_PAYLOAD_VERSION = 1;

const childSchema = z.object({ id: z.string(), name: z.string() });

const candidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string().nullable(),
});

const inputSchema = z.object({
  title: z.string(),
  category: z.string().nullable(),
  startDate: z.string(),
  startTime: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  children: z.array(childSchema),
  candidates: z.array(candidateSchema),
  locale: z.string(),
});

export const queuePayloadSchema = z.object({
  version: z.literal(QUEUE_PAYLOAD_VERSION),
  /** Auth id of whoever saved the event — the person we notify when it lands. */
  requestedBy: z.string(),
  familyId: z.string(),
  /** Why the synchronous attempt gave up; carried through for the audit trail. */
  reason: z.string(),
  input: inputSchema,
});

export type QueuePayload = z.infer<typeof queuePayloadSchema>;

export function buildQueuePayload(params: {
  requestedBy: string;
  familyId: string;
  reason: string;
  input: AiSuggestionInput;
}): QueuePayload {
  return {
    version: QUEUE_PAYLOAD_VERSION,
    requestedBy: params.requestedBy,
    familyId: params.familyId,
    reason: params.reason,
    input: params.input,
  };
}

/**
 * Validate a row's `tasks` column. A payload written by an older version of
 * the app is rejected rather than half-read — the worker marks the row failed
 * instead of running with a partially understood request.
 */
export function parseQueuePayload(
  raw: unknown,
): { ok: true; payload: QueuePayload } | { ok: false; error: string } {
  const result = queuePayloadSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'unrecognised queue payload' };
  }
  return { ok: true, payload: result.data };
}
