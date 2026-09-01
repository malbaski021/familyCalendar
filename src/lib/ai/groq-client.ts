import 'server-only';
import { DEFAULT_GROQ_MODEL } from '@/lib/ai/constants';
import type { GroqCallParams, GroqCallResult } from '@/lib/ai/types';

// Groq exposes an OpenAI-compatible REST endpoint, so a plain `fetch` is
// enough — no SDK dependency for one endpoint.
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Whether a key is present. Read lazily on every call rather than at module
 * load: `next build` and CI run without `GROQ_API_KEY`, and importing this
 * module must not blow up there.
 */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export function groqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
}

/** Rate-limit headers Groq returns; surfaced for logging and queue pacing. */
export interface GroqRateLimit {
  remainingRequests: number | null;
  remainingTokens: number | null;
  resetRequests: string | null;
  resetTokens: string | null;
}

export function readRateLimit(headers: Headers): GroqRateLimit {
  const num = (name: string) => {
    const raw = headers.get(name);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    remainingRequests: num('x-ratelimit-remaining-requests'),
    remainingTokens: num('x-ratelimit-remaining-tokens'),
    resetRequests: headers.get('x-ratelimit-reset-requests'),
    resetTokens: headers.get('x-ratelimit-reset-tokens'),
  };
}

/** `retry-after` is seconds per the HTTP spec; Groq also sends fractional values. */
export function parseRetryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : undefined;
}

/**
 * One chat completion against Groq.
 *
 * Never throws — every outcome is a `GroqCallResult`, because the orchestrator
 * must be able to fall through to `ai_queue` without a try/catch at the call
 * site. `signal` comes from the orchestrator's budget; an abort surfaces as
 * `reason: 'timeout'`.
 */
export async function callGroq(params: GroqCallParams): Promise<GroqCallResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: 'not-configured',
      message: 'GROQ_API_KEY is not set',
    };
  }

  let response: Response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: groqModel(),
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        // Ask for JSON explicitly; we still parse defensively because the
        // response_format guarantee is not worth betting the save on.
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: params.signal,
      cache: 'no-store',
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      reason: aborted ? 'timeout' : 'network',
      message: aborted ? 'request aborted by timeout budget' : `network error: ${describe(err)}`,
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      reason: 'rate-limited',
      message: 'Groq rate limit reached',
      status: 429,
      retryAfterMs: parseRetryAfterMs(response.headers),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: 'http-error',
      message: `Groq responded ${response.status}: ${await safeText(response)}`,
      status: response.status,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    return { ok: false, reason: 'empty', message: `unreadable body: ${describe(err)}` };
  }

  const content = firstMessageContent(body);
  if (!content) {
    return { ok: false, reason: 'empty', message: 'no message content in Groq response' };
  }

  return { ok: true, content };
}

function firstMessageContent(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } })?.message;
  const content = message?.content;
  return typeof content === 'string' && content.trim().length > 0 ? content : null;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '(no body)';
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
