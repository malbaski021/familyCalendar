'use server';

import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getFamilyContextFor } from '@/lib/family/get-family-context';
import { logAudit } from '@/lib/audit/log';
import { loadSuggestionInput } from '@/lib/ai/candidates';
import { callGroq } from '@/lib/ai/groq-client';
import { orchestrate } from '@/lib/ai/orchestrate';
import { enqueueAiTask, processQueuedTask } from '@/lib/ai/queue';
import type { AiSuggestions } from '@/lib/ai/schemas';

// The seam between the app and the AI subsystem.
//
// Deliberately NOT called from `createEventAction`: the save must return as
// soon as the row is written. The client saves first, then asks for
// suggestions, so a slow or dead Groq only ever delays a hint — never the
// event itself. `ai_queue.event_id` is NOT NULL, which is the other reason
// this runs post-save: a queued task needs an event to belong to.

export type SuggestionsResult =
  | { status: 'ready'; suggestions: AiSuggestions }
  /** Parked in `ai_queue`; a push arrives when it lands. */
  | { status: 'queued'; reason: string }
  /** Nothing to wait for — no key, or a request the API rejected. */
  | { status: 'unavailable'; reason: string };

/**
 * Ask the agents about an event the caller has just saved.
 *
 * Never throws and never reports a hard error: from the UI's point of view
 * suggestions either arrive, are coming later, or are not available.
 */
export async function requestSuggestionsAction(input: {
  eventId: string;
  locale?: string;
}): Promise<SuggestionsResult> {
  const user = await getCurrentUser();
  if (!user) return { status: 'unavailable', reason: 'not authenticated' };

  const family = await getFamilyContextFor(user.authId);
  if (!family) return { status: 'unavailable', reason: 'no family' };

  const suggestionInput = await loadSuggestionInput({
    eventId: input.eventId,
    familyId: family.familyId,
    locale: input.locale ?? user.profile.language ?? 'en',
  });
  if (!suggestionInput) return { status: 'unavailable', reason: 'event not found' };

  const outcome = await orchestrate(suggestionInput, { call: callGroq });

  if (outcome.status === 'ready') {
    await logAudit({
      familyId: family.familyId,
      actorType: 'ai',
      actorId: null,
      action: 'ai.suggested',
      entity: 'events',
      entityId: input.eventId,
      newData: {
        category: outcome.suggestions.categorization.category,
        child_ids: outcome.suggestions.categorization.childIds,
        new_child_names: outcome.suggestions.categorization.newChildNames,
        is_duplicate: outcome.suggestions.duplicates.isDuplicate,
        reminder_count: outcome.suggestions.reminders.suggestions.length,
      },
    });
    return { status: 'ready', suggestions: outcome.suggestions };
  }

  if (outcome.status === 'queued') {
    await enqueueAiTask({
      eventId: input.eventId,
      familyId: family.familyId,
      requestedBy: user.authId,
      input: suggestionInput,
      reason: outcome.reason,
    });
    return { status: 'queued', reason: outcome.reason };
  }

  return { status: 'unavailable', reason: outcome.reason };
}

/**
 * Drive one queued task to completion. Called by the realtime subscriber when
 * a new `ai_queue` row appears, and by the F17 retry cron.
 *
 * Safe to call concurrently: `processQueuedTask` claims the row atomically, so
 * a second caller gets `skipped` rather than doing the work twice.
 */
export async function processAiTaskAction(input: {
  taskId: string;
}): Promise<{ status: 'done' | 'failed' | 'skipped' }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'skipped' };

  const outcome = await processQueuedTask(input.taskId);
  return { status: outcome.status };
}
