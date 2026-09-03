import { z } from 'zod';
import { CATEGORY_STYLES } from '@/lib/calendar/categories';

const CATEGORY_KEYS = Object.keys(CATEGORY_STYLES) as [
  keyof typeof CATEGORY_STYLES,
  ...(keyof typeof CATEGORY_STYLES)[],
];

// --- Input the orchestrator assembles for the model -------------------------

export interface AiChild {
  id: string;
  name: string;
}

/** A trimmed existing event, used only for duplicate detection. */
export interface AiDuplicateCandidate {
  id: string;
  title: string;
  date: string;
  time: string | null;
}

export interface AiSuggestionInput {
  title: string;
  /** Whatever the user picked in the form, if anything. */
  category: string | null;
  startDate: string;
  startTime: string | null;
  location: string | null;
  notes: string | null;
  children: AiChild[];
  candidates: AiDuplicateCandidate[];
  /** Drives the language of `userMessage`. */
  locale: string;
}

// --- What we require back ---------------------------------------------------

export const duplicateResultSchema = z.object({
  isDuplicate: z.boolean(),
  /** Must be one of the candidate ids we sent, or null. */
  matchEventId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(300),
});

export const categorizationResultSchema = z.object({
  category: z.enum(CATEGORY_KEYS),
  confidence: z.number().min(0).max(1),
  /** Ids from the family's children list. Cross-checked against the ids we
   *  actually sent, which is what stops a hallucinated child reaching the UI —
   *  the model is not asked for unknown names at all. */
  childIds: z.array(z.string()),
});

export const reminderSuggestionSchema = z.object({
  // 0 = at start; capped at one week so a hallucinated number can't produce a
  // nonsensical reminder row.
  minutesBefore: z.number().int().min(0).max(10080),
  label: z.string().max(80),
});

export const reminderResultSchema = z.object({
  suggestions: z.array(reminderSuggestionSchema).max(4),
});

export const aiSuggestionSchema = z.object({
  duplicates: duplicateResultSchema,
  categorization: categorizationResultSchema,
  reminders: reminderResultSchema,
  /** Short, human-readable summary in the user's language. */
  userMessage: z.string().max(400),
});

export type DuplicateResult = z.infer<typeof duplicateResultSchema>;
export type CategorizationResult = z.infer<typeof categorizationResultSchema>;
export type ReminderResult = z.infer<typeof reminderResultSchema>;
export type AiSuggestions = z.infer<typeof aiSuggestionSchema>;

// --- Parsing ----------------------------------------------------------------

/**
 * Pull a JSON object out of raw model output. Models wrap JSON in ```json
 * fences often enough that failing on it would send perfectly good
 * suggestions to the queue for no reason.
 */
export function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export type ParseResult = { ok: true; data: AiSuggestions } | { ok: false; error: string };

/**
 * Parse and validate a model response. Anything malformed is a soft failure —
 * the caller degrades to "no suggestions", it never bubbles up as a throw.
 *
 * `knownChildIds` and `knownCandidateIds` are cross-checked so a hallucinated
 * id can't reach the UI and auto-tag the wrong child or point at an event that
 * doesn't exist.
 */
export function parseSuggestions(
  raw: string,
  context: { knownChildIds: string[]; knownCandidateIds: string[] },
): ParseResult {
  const json = extractJson(raw);
  if (!json) return { ok: false, error: 'no JSON object in model output' };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  const result = aiSuggestionSchema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'schema mismatch' };
  }

  const data = result.data;
  const childIds = new Set(context.knownChildIds);
  const candidateIds = new Set(context.knownCandidateIds);

  return {
    ok: true,
    data: {
      ...data,
      duplicates: {
        ...data.duplicates,
        // Drop a match that points at an event we never offered.
        matchEventId:
          data.duplicates.matchEventId && candidateIds.has(data.duplicates.matchEventId)
            ? data.duplicates.matchEventId
            : null,
        isDuplicate:
          data.duplicates.isDuplicate &&
          !!data.duplicates.matchEventId &&
          candidateIds.has(data.duplicates.matchEventId),
      },
      categorization: {
        ...data.categorization,
        childIds: data.categorization.childIds.filter((id) => childIds.has(id)),
      },
    },
  };
}
