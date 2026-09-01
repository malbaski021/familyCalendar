import { AI_SYNC_TIMEOUT_MS } from '@/lib/ai/constants';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompt';
import { parseSuggestions, type AiSuggestionInput, type AiSuggestions } from '@/lib/ai/schemas';
import type { GroqCall } from '@/lib/ai/types';

/**
 * Outcome of the synchronous suggestion attempt.
 *
 * There is no error variant on purpose. Saving an event must never be blocked
 * by AI, so every failure is expressed as either "try again in the background"
 * or "don't bother" — the caller saves regardless.
 */
export type SuggestionOutcome =
  | { status: 'ready'; suggestions: AiSuggestions }
  /** Transient: worth retrying via `ai_queue`. */
  | { status: 'queued'; reason: string }
  /** Permanent for this request: retrying would fail the same way. */
  | { status: 'unavailable'; reason: string };

export interface OrchestrateDeps {
  call: GroqCall;
  /** Overridable budget, mainly so tests don't have to wait 3 real seconds. */
  timeoutMs?: number;
}

/**
 * Run the three agents as a single request and validate what comes back.
 *
 * Guarantees, all covered by tests:
 *   - never throws, whatever the injected caller does;
 *   - never runs longer than the budget, even if the caller ignores its signal;
 *   - never returns ids the model was not given.
 */
export async function orchestrate(
  input: AiSuggestionInput,
  deps: OrchestrateDeps,
): Promise<SuggestionOutcome> {
  const timeoutMs = deps.timeoutMs ?? AI_SYNC_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const budget = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve('timeout');
      }, timeoutMs);
    });

    const call = deps.call({
      system: buildSystemPrompt(input.locale),
      user: buildUserPrompt(input),
      signal: controller.signal,
    });

    // Race the call against the budget so a caller that ignores `signal`
    // still cannot hold up the save.
    const result = await Promise.race([call, budget]);

    if (result === 'timeout') {
      return { status: 'queued', reason: `no response within ${timeoutMs}ms` };
    }

    if (!result.ok) {
      return failureOutcome(result.reason, result.message, result.status);
    }

    const parsed = parseSuggestions(result.content, {
      knownChildIds: input.children.map((c) => c.id),
      knownCandidateIds: input.candidates.map((c) => c.id),
    });

    if (!parsed.ok) {
      // A malformed reply is usually a one-off; another attempt may well parse.
      return { status: 'queued', reason: `unusable response (${parsed.error})` };
    }

    return { status: 'ready', suggestions: parsed.data };
  } catch (err) {
    // Belt and braces: a caller that throws must not take the save down.
    return {
      status: 'queued',
      reason: `caller threw (${err instanceof Error ? err.message : 'unknown'})`,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function failureOutcome(
  reason: string,
  message: string,
  status: number | undefined,
): SuggestionOutcome {
  switch (reason) {
    case 'not-configured':
      // No API key. Queueing would just pile up work that can never run.
      return { status: 'unavailable', reason: message };
    case 'http-error':
      // 4xx other than 429 means we sent something the API rejected; retrying
      // an identical request would fail identically. 5xx is worth another go.
      if (status && status >= 400 && status < 500 && status !== 429) {
        return { status: 'unavailable', reason: message };
      }
      return { status: 'queued', reason: message };
    default:
      // timeout / rate-limited / network / empty — all transient.
      return { status: 'queued', reason: message };
  }
}
