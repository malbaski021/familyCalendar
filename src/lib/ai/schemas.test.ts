import { describe, it, expect } from 'vitest';
import { extractJson, parseSuggestions } from './schemas';

const CONTEXT = {
  knownChildIds: ['child-luka', 'child-mila'],
  knownCandidateIds: ['event-a', 'event-b'],
};

function validResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    duplicates: {
      isDuplicate: false,
      matchEventId: null,
      confidence: 0.1,
      reason: 'nothing similar nearby',
    },
    categorization: {
      category: 'match',
      confidence: 0.9,
      childIds: ['child-luka'],
      newChildNames: [],
    },
    reminders: {
      suggestions: [{ minutesBefore: 1440, label: 'Day before' }],
    },
    userMessage: 'Tagged as a match for Luka.',
    ...overrides,
  });
}

describe('extractJson', () => {
  it('returns a bare JSON object unchanged', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it('unwraps a ```json fenced block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('unwraps an unlabelled fenced block', () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips prose around the object', () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toBe('{"a":1}');
  });

  it('returns null when there is no object at all', () => {
    expect(extractJson('I cannot help with that.')).toBeNull();
    expect(extractJson('   ')).toBeNull();
  });
});

describe('parseSuggestions', () => {
  it('accepts a well-formed response', () => {
    const result = parseSuggestions(validResponse(), CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.categorization.category).toBe('match');
    expect(result.data.reminders.suggestions).toHaveLength(1);
  });

  it('accepts a response wrapped in code fences', () => {
    const result = parseSuggestions('```json\n' + validResponse() + '\n```', CONTEXT);
    expect(result.ok).toBe(true);
  });

  it('rejects malformed JSON without throwing', () => {
    const result = parseSuggestions('{"duplicates": ', CONTEXT);
    expect(result.ok).toBe(false);
  });

  it('rejects a response missing a section', () => {
    const result = parseSuggestions(JSON.stringify({ duplicates: {} }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown category', () => {
    const raw = validResponse({
      categorization: { category: 'wedding', confidence: 1, childIds: [], newChildNames: [] },
    });
    expect(parseSuggestions(raw, CONTEXT).ok).toBe(false);
  });

  it('rejects a reminder beyond the one-week cap', () => {
    const raw = validResponse({
      reminders: { suggestions: [{ minutesBefore: 999999, label: 'someday' }] },
    });
    expect(parseSuggestions(raw, CONTEXT).ok).toBe(false);
  });

  it('drops a hallucinated child id', () => {
    const raw = validResponse({
      categorization: {
        category: 'school',
        confidence: 0.8,
        childIds: ['child-luka', 'child-does-not-exist'],
        newChildNames: [],
      },
    });
    const result = parseSuggestions(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.categorization.childIds).toEqual(['child-luka']);
  });

  it('keeps a duplicate match that points at a real candidate', () => {
    const raw = validResponse({
      duplicates: {
        isDuplicate: true,
        matchEventId: 'event-b',
        confidence: 0.95,
        reason: 'same training, different wording',
      },
    });
    const result = parseSuggestions(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.duplicates).toMatchObject({ isDuplicate: true, matchEventId: 'event-b' });
  });

  it('discards a duplicate match pointing at an event we never sent', () => {
    const raw = validResponse({
      duplicates: {
        isDuplicate: true,
        matchEventId: 'event-invented',
        confidence: 0.99,
        reason: 'hallucinated',
      },
    });
    const result = parseSuggestions(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both the id and the flag must be cleared, or the UI would warn about a
    // duplicate the user cannot open.
    expect(result.data.duplicates.matchEventId).toBeNull();
    expect(result.data.duplicates.isDuplicate).toBe(false);
  });

  it('clears isDuplicate when the model sets the flag but no id', () => {
    const raw = validResponse({
      duplicates: { isDuplicate: true, matchEventId: null, confidence: 0.5, reason: 'unsure' },
    });
    const result = parseSuggestions(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.duplicates.isDuplicate).toBe(false);
  });

  it('keeps newChildNames, which are not id-checked', () => {
    const raw = validResponse({
      categorization: {
        category: 'match',
        confidence: 0.7,
        childIds: [],
        newChildNames: ['Stefan'],
      },
    });
    const result = parseSuggestions(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.categorization.newChildNames).toEqual(['Stefan']);
  });
});
