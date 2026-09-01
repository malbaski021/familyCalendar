// Shared AI types. Deliberately free of `server-only` so the orchestrator core
// and its tests can import them without pulling in the fetch client.

/** Why a Groq call did not produce usable content. */
export type GroqFailureReason =
  | 'not-configured'
  | 'timeout'
  | 'rate-limited'
  | 'http-error'
  | 'network'
  | 'empty';

export type GroqCallResult =
  | { ok: true; content: string }
  | {
      ok: false;
      reason: GroqFailureReason;
      message: string;
      /** HTTP status, when the failure came from a response. */
      status?: number;
      /** Honoured `retry-after`, in ms, when the provider sent one. */
      retryAfterMs?: number;
    };

export interface GroqCallParams {
  system: string;
  user: string;
  signal?: AbortSignal;
}

/** The single seam the orchestrator depends on — swapped for a fake in tests. */
export type GroqCall = (params: GroqCallParams) => Promise<GroqCallResult>;
