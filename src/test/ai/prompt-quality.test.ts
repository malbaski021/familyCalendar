// Prompt-quality harness — run with `npm run test:ai`.
//
// Calls the real Groq model through the production code path. Not part of CI:
// it needs a key and spends free-tier quota. Run it after touching anything in
// `src/lib/ai/agents/**` or `src/lib/ai/prompt.ts`.
//
// The first version of the categorisation prompt defined "match" as a
// competitive fixture, so "Luka fudbal subota" came back as "other" — correct
// per the prompt, wrong per the product. No mocked test could have caught it.
// These cases exist so that class of regression fails loudly.
import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { callGroq } from '@/lib/ai/groq-client';
import { orchestrate } from '@/lib/ai/orchestrate';
import { AI_SYNC_TIMEOUT_MS } from '@/lib/ai/constants';
import type { AiDuplicateCandidate } from '@/lib/ai/schemas';

config({ path: resolve(process.cwd(), '.env.local'), quiet: true });

const hasKey = !!process.env.GROQ_API_KEY;

const CHILDREN = [
  { id: 'child-luka', name: 'Luka' },
  { id: 'child-mila', name: 'Mila' },
];

interface Expectation {
  category: string;
  /** Child id that must be tagged, or null when none should be. */
  child: string | null;
  duplicate: boolean;
  /** Names that must surface as "not in the family yet". */
  newNames?: string[];
}

interface Case {
  name: string;
  title: string;
  startDate: string;
  startTime: string | null;
  locale: string;
  candidates: AiDuplicateCandidate[];
  expect: Expectation;
}

const CASES: Case[] = [
  {
    // Verbatim from the F11 acceptance criterion in DEVELOPMENT_PLAN.md.
    name: 'acceptance criterion: football Saturday is a match for Luka',
    title: 'Luka football Saturday',
    startDate: '2026-09-05',
    startTime: '10:00',
    locale: 'en',
    candidates: [{ id: 'event-a', title: 'Fudbal trening', date: '2026-09-05', time: '10:00' }],
    expect: { category: 'match', child: 'child-luka', duplicate: true },
  },
  {
    // Regression guard: training is a sporting activity, not "other".
    name: 'training counts as a sporting activity',
    title: 'Trening kosarka Luka',
    startDate: '2026-09-12',
    startTime: '17:00',
    locale: 'sr-Latn',
    candidates: [],
    expect: { category: 'match', child: 'child-luka', duplicate: false },
  },
  {
    name: 'dental check-up is a doctor appointment',
    title: 'Mila zubar kontrola',
    startDate: '2026-09-20',
    startTime: '08:30',
    locale: 'sr-Latn',
    candidates: [],
    expect: { category: 'doctor', child: 'child-mila', duplicate: false },
  },
  {
    // An unknown name must never be invented as a childId.
    name: 'unknown name surfaces as a new child, not a tag',
    title: 'Stefan rodjendan',
    startDate: '2026-10-02',
    startTime: '17:00',
    locale: 'sr-Latn',
    candidates: [],
    expect: { category: 'birthday', child: null, duplicate: false, newNames: ['Stefan'] },
  },
  {
    // Serbian declension: "za Luku" is still Luka.
    name: 'inflected Serbian name resolves to the right child',
    title: 'Roditeljski sastanak za Luku',
    startDate: '2026-09-11',
    startTime: '18:00',
    locale: 'sr-Latn',
    candidates: [],
    expect: { category: 'school', child: 'child-luka', duplicate: false },
  },
  {
    // Same activity, different day — a separate occurrence, not a duplicate.
    name: 'a later occurrence of the same activity is not a duplicate',
    title: 'Fudbal trening',
    startDate: '2026-09-12',
    startTime: '10:00',
    locale: 'sr-Latn',
    candidates: [{ id: 'event-a', title: 'Fudbal trening', date: '2026-09-10', time: '10:00' }],
    expect: { category: 'match', child: null, duplicate: false },
  },
];

describe.skipIf(!hasKey)('prompt quality against the real model', () => {
  if (!hasKey) return;

  for (const testCase of CASES) {
    it(testCase.name, async () => {
      const started = Date.now();
      const outcome = await orchestrate(
        {
          title: testCase.title,
          category: null,
          startDate: testCase.startDate,
          startTime: testCase.startTime,
          location: null,
          notes: null,
          children: CHILDREN,
          candidates: testCase.candidates,
          locale: testCase.locale,
        },
        { call: callGroq },
      );
      const elapsed = Date.now() - started;

      expect(outcome.status, `expected suggestions, got ${outcome.status}`).toBe('ready');
      if (outcome.status !== 'ready') return;

      const { categorization, duplicates, reminders, userMessage } = outcome.suggestions;
      console.log(
        `\n  ${testCase.name} (${elapsed}ms)` +
          `\n    category=${categorization.category} children=[${categorization.childIds.join(', ')}]` +
          ` new=[${categorization.newChildNames.join(', ')}] duplicate=${duplicates.isDuplicate}` +
          `\n    reminders=[${reminders.suggestions.map((r) => r.minutesBefore).join(', ')}]` +
          `\n    message="${userMessage}"`,
      );

      expect(categorization.category).toBe(testCase.expect.category);
      expect(duplicates.isDuplicate).toBe(testCase.expect.duplicate);

      if (testCase.expect.child) {
        expect(categorization.childIds).toContain(testCase.expect.child);
      } else {
        expect(categorization.childIds).toEqual([]);
      }

      for (const name of testCase.expect.newNames ?? []) {
        expect(categorization.newChildNames).toContain(name);
      }

      // The synchronous path is only useful if it fits the budget; a model or
      // prompt change that doubles latency should be visible here.
      expect(elapsed).toBeLessThan(AI_SYNC_TIMEOUT_MS * 2);
    });
  }
});

describe.skipIf(hasKey)('prompt quality (skipped)', () => {
  it('needs GROQ_API_KEY in .env.local', () => {
    expect(hasKey).toBe(false);
  });
});
