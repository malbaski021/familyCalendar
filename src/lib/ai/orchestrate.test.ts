import { describe, it, expect, vi } from 'vitest';
import { orchestrate } from './orchestrate';
import type { AiSuggestionInput } from './schemas';
import type { GroqCall, GroqCallResult } from './types';

const INPUT: AiSuggestionInput = {
  title: 'Luka fudbal subota',
  category: null,
  startDate: '2026-09-05',
  startTime: '10:00',
  location: 'Mali stadion',
  notes: null,
  children: [{ id: 'child-luka', name: 'Luka' }],
  candidates: [{ id: 'event-a', title: 'Fudbal trening', date: '2026-09-05', time: '10:00' }],
  locale: 'sr-Latn',
};

const VALID_CONTENT = JSON.stringify({
  duplicates: {
    isDuplicate: true,
    matchEventId: 'event-a',
    confidence: 0.9,
    reason: 'isti trening',
  },
  categorization: {
    category: 'match',
    confidence: 0.85,
    childIds: ['child-luka'],
    newChildNames: [],
  },
  reminders: { suggestions: [{ minutesBefore: 120, label: 'Dva sata ranije' }] },
  userMessage: 'Izgleda kao duplikat postojećeg treninga.',
});

function caller(result: GroqCallResult): GroqCall {
  return vi.fn(async () => result);
}

describe('orchestrate — happy path', () => {
  it('returns parsed suggestions', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: true, content: VALID_CONTENT }),
    });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.suggestions.categorization.childIds).toEqual(['child-luka']);
    expect(outcome.suggestions.duplicates.matchEventId).toBe('event-a');
  });

  it('passes both prompts and an abort signal to the caller', async () => {
    const call = caller({ ok: true, content: VALID_CONTENT });
    await orchestrate(INPUT, { call });
    expect(call).toHaveBeenCalledTimes(1);
    const args = vi.mocked(call).mock.calls[0][0];
    expect(args.system).toContain('Task 1');
    expect(args.user).toContain('Luka fudbal subota');
    expect(args.user).toContain('id=child-luka');
    expect(args.signal).toBeInstanceOf(AbortSignal);
  });

  it('asks for the summary in the caller locale', async () => {
    const call = caller({ ok: true, content: VALID_CONTENT });
    await orchestrate({ ...INPUT, locale: 'sr-Latn' }, { call });
    expect(vi.mocked(call).mock.calls[0][0].system).toContain('Serbian');
  });
});

describe('orchestrate — the save is never blocked', () => {
  it('queues when the caller never resolves, and aborts it', async () => {
    let captured: AbortSignal | undefined;
    const call: GroqCall = ({ signal }) => {
      captured = signal;
      return new Promise<GroqCallResult>(() => {
        /* never settles */
      });
    };

    const outcome = await orchestrate(INPUT, { call, timeoutMs: 20 });

    expect(outcome.status).toBe('queued');
    expect(captured?.aborted).toBe(true);
  });

  it('queues when the caller throws', async () => {
    const call: GroqCall = async () => {
      throw new Error('socket exploded');
    };
    const outcome = await orchestrate(INPUT, { call });
    expect(outcome.status).toBe('queued');
    if (outcome.status !== 'queued') return;
    expect(outcome.reason).toContain('socket exploded');
  });

  it('queues on a rate limit', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: false, reason: 'rate-limited', message: 'slow down', status: 429 }),
    });
    expect(outcome.status).toBe('queued');
  });

  it('queues on a network failure', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: false, reason: 'network', message: 'ENOTFOUND' }),
    });
    expect(outcome.status).toBe('queued');
  });

  it('queues on an empty response', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: false, reason: 'empty', message: 'no content' }),
    });
    expect(outcome.status).toBe('queued');
  });

  it('queues on a 5xx', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: false, reason: 'http-error', message: 'bad gateway', status: 502 }),
    });
    expect(outcome.status).toBe('queued');
  });

  it('queues when the model returns unusable content', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: true, content: 'Sorry, I cannot do that.' }),
    });
    expect(outcome.status).toBe('queued');
    if (outcome.status !== 'queued') return;
    expect(outcome.reason).toContain('unusable response');
  });

  it('marks a missing API key as unavailable rather than queued', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: false, reason: 'not-configured', message: 'GROQ_API_KEY is not set' }),
    });
    // Queueing would pile up work that can never drain.
    expect(outcome.status).toBe('unavailable');
  });

  it('marks a 400 as unavailable — an identical retry would fail identically', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: false, reason: 'http-error', message: 'bad request', status: 400 }),
    });
    expect(outcome.status).toBe('unavailable');
  });

  it('still queues a 429 even though it is a 4xx', async () => {
    const outcome = await orchestrate(INPUT, {
      call: caller({ ok: false, reason: 'http-error', message: 'too many', status: 429 }),
    });
    expect(outcome.status).toBe('queued');
  });
});

describe('orchestrate — hostile model output', () => {
  it('never surfaces ids that were not supplied', async () => {
    const content = JSON.stringify({
      duplicates: {
        isDuplicate: true,
        matchEventId: 'event-hallucinated',
        confidence: 1,
        reason: 'made up',
      },
      categorization: {
        category: 'other',
        confidence: 1,
        childIds: ['child-hallucinated'],
        newChildNames: [],
      },
      reminders: { suggestions: [] },
      userMessage: 'ok',
    });

    const outcome = await orchestrate(INPUT, { call: caller({ ok: true, content }) });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.suggestions.duplicates.matchEventId).toBeNull();
    expect(outcome.suggestions.duplicates.isDuplicate).toBe(false);
    expect(outcome.suggestions.categorization.childIds).toEqual([]);
  });

  it('resolves within the budget even if the caller ignores the signal', async () => {
    const call: GroqCall = () =>
      new Promise<GroqCallResult>((resolve) =>
        setTimeout(() => resolve({ ok: true, content: VALID_CONTENT }), 5000),
      );

    const started = Date.now();
    const outcome = await orchestrate(INPUT, { call, timeoutMs: 30 });

    expect(outcome.status).toBe('queued');
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
