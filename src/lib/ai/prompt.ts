import { categorizationInstruction } from '@/lib/ai/agents/categorization';
import { duplicateInstruction } from '@/lib/ai/agents/duplicates';
import { reminderInstruction } from '@/lib/ai/agents/reminders';
import type { AiSuggestionInput } from '@/lib/ai/schemas';

// The three agents from the proposal keep their own prompts and result shapes,
// but the orchestrator sends them as ONE request. On Groq's free tier the
// binding constraint is tokens-per-minute, and three separate calls would
// triple both that and the daily request count for no gain — the tasks share
// almost all of their context (the event, the children, the candidates).
// Splitting them back into parallel calls is a prompt-only change if we ever
// move off the free tier.

const LANGUAGE_BY_LOCALE: Record<string, string> = {
  en: 'English',
  'sr-Latn': 'Serbian (Latin script)',
};

export function languageFor(locale: string): string {
  return LANGUAGE_BY_LOCALE[locale] ?? 'English';
}

export function buildSystemPrompt(locale: string): string {
  return `You assist a family calendar app. You will be given one event a user is
about to save, the family's children, and a short list of nearby existing
events. Complete the three tasks below.

${duplicateInstruction}

${categorizationInstruction}

## Task 4 — summary
Write "userMessage": one or two short sentences in ${languageFor(locale)}
telling the user what you concluded. Mention a duplicate if you found one.
Do not list the reminders verbatim — the UI shows them separately.

${reminderInstruction}

## Output
Reply with a single JSON object and nothing else. No prose, no code fences.
Use exactly this shape:

{
  "duplicates": { "isDuplicate": boolean, "matchEventId": string|null, "confidence": number, "reason": string },
  "categorization": { "category": string, "confidence": number, "childIds": string[] },
  "reminders": { "suggestions": [ { "minutesBefore": number, "label": string } ] },
  "userMessage": string
}

"confidence" is between 0 and 1. Never invent an id that was not given to you.`;
}

export function buildUserPrompt(input: AiSuggestionInput): string {
  const lines: string[] = [];

  lines.push('# New event');
  lines.push(`Title: ${input.title}`);
  lines.push(`Date: ${input.startDate}`);
  lines.push(`Time: ${input.startTime ?? '(all day)'}`);
  if (input.category) lines.push(`Category picked by user: ${input.category}`);
  if (input.location) lines.push(`Location: ${input.location}`);
  if (input.notes) lines.push(`Notes: ${input.notes}`);

  lines.push('');
  lines.push('# Family children');
  if (input.children.length === 0) {
    lines.push('(none registered)');
  } else {
    for (const child of input.children) {
      lines.push(`- id=${child.id} name=${child.name}`);
    }
  }

  lines.push('');
  lines.push('# Existing events (duplicate candidates)');
  if (input.candidates.length === 0) {
    lines.push('(none nearby)');
  } else {
    for (const candidate of input.candidates) {
      lines.push(
        `- id=${candidate.id} date=${candidate.date} time=${candidate.time ?? 'all day'} title=${candidate.title}`,
      );
    }
  }

  return lines.join('\n');
}
