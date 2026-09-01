import { describe, it, expect } from 'vitest';
import { buildQueuePayload, parseQueuePayload, QUEUE_PAYLOAD_VERSION } from './queue-payload';
import type { AiSuggestionInput } from './schemas';

const INPUT: AiSuggestionInput = {
  title: 'Luka fudbal',
  category: null,
  startDate: '2026-09-05',
  startTime: '10:00',
  location: 'Stadion',
  notes: null,
  children: [{ id: 'child-luka', name: 'Luka' }],
  candidates: [{ id: 'event-a', title: 'Trening', date: '2026-09-05', time: '10:00' }],
  locale: 'sr-Latn',
};

const PARAMS = {
  requestedBy: 'user-1',
  familyId: 'family-1',
  reason: 'no response within 3000ms',
  input: INPUT,
};

describe('buildQueuePayload', () => {
  it('stamps the current version', () => {
    expect(buildQueuePayload(PARAMS).version).toBe(QUEUE_PAYLOAD_VERSION);
  });

  it('keeps the payload self-contained so a worker can redo the request', () => {
    const payload = buildQueuePayload(PARAMS);
    expect(payload.requestedBy).toBe('user-1');
    expect(payload.familyId).toBe('family-1');
    expect(payload.input.children).toHaveLength(1);
    expect(payload.input.candidates).toHaveLength(1);
  });

  it('round-trips through JSON, as the jsonb column requires', () => {
    const payload = buildQueuePayload(PARAMS);
    const result = parseQueuePayload(JSON.parse(JSON.stringify(payload)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual(payload);
  });
});

describe('parseQueuePayload', () => {
  it('rejects a payload from a future or unknown version', () => {
    const payload = { ...buildQueuePayload(PARAMS), version: 99 };
    expect(parseQueuePayload(payload).ok).toBe(false);
  });

  it('rejects a payload missing the requester', () => {
    const payload = buildQueuePayload(PARAMS) as Record<string, unknown>;
    delete payload.requestedBy;
    expect(parseQueuePayload(payload).ok).toBe(false);
  });

  it('rejects a payload whose input lost a required field', () => {
    const payload = buildQueuePayload(PARAMS);
    const broken = { ...payload, input: { ...payload.input, startDate: undefined } };
    expect(parseQueuePayload(broken).ok).toBe(false);
  });

  it('rejects junk without throwing', () => {
    expect(parseQueuePayload(null).ok).toBe(false);
    expect(parseQueuePayload('nope').ok).toBe(false);
    expect(parseQueuePayload({}).ok).toBe(false);
  });
});
