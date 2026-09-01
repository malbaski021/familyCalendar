// Shared AI constants. Kept out of the `'use server'` action modules, which are
// only allowed to export async functions.

/**
 * Hard budget for the synchronous suggestion path. The proposal requires that
 * saving an event is NEVER blocked by AI, so the orchestrator abandons the
 * request at this point and hands the work to `ai_queue` instead.
 */
export const AI_SYNC_TIMEOUT_MS = 3000;

/**
 * Model id, overridable without a redeploy. Default is Groq's `gpt-oss-120b`:
 * on the free tier it allows 30 RPM / 8k TPM / 1k requests per day, which is
 * ample for a family calendar once the three agents share a single request.
 * `llama-3.1-8b-instant` is the fallback if the daily cap ever bites — it
 * trades quality for a 14.4k daily allowance.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

/**
 * How many existing events we are willing to show the duplicate-detection
 * agent. Candidates are pre-filtered in SQL to a narrow date window first;
 * this is the belt-and-braces cap that keeps us inside the free-tier
 * tokens-per-minute ceiling, which is the real constraint (not requests).
 */
export const MAX_DUPLICATE_CANDIDATES = 8;

/** Date window (in days, either side of the new event) used to pick candidates. */
export const DUPLICATE_WINDOW_DAYS = 3;
