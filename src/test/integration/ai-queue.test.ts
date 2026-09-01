import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { claimTask, enqueueAiTask, listPendingTasks, processQueuedTask } from '@/lib/ai/queue';
import { buildQueuePayload } from '@/lib/ai/queue-payload';
import type { AiSuggestionInput } from '@/lib/ai/schemas';
import type { GroqCall } from '@/lib/ai/types';
import type { Database } from '@/types/database';

// Exercises the real queue module against real Postgres. Groq is injected, so
// this runs in CI with no API key — the point here is the status lifecycle and
// the duplicate-processing guard, not model quality (that lives in
// `npm run test:ai`).

const url = process.env.SUPABASE_LOCAL_URL!;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY!;

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const JOVIC_FAMILY_ID = '44444444-4444-4444-4444-444444444444';
const JOVIC_TATA_ID = '22222222-2222-2222-2222-222222222222';

const INPUT: AiSuggestionInput = {
  title: 'Luka fudbal',
  category: null,
  startDate: '2031-05-05',
  startTime: '10:00',
  location: null,
  notes: null,
  children: [{ id: 'child-luka', name: 'Luka' }],
  candidates: [],
  locale: 'sr-Latn',
};

function suggestionsFor(category: string): string {
  return JSON.stringify({
    duplicates: { isDuplicate: false, matchEventId: null, confidence: 0.1, reason: 'none' },
    categorization: { category, confidence: 0.9, childIds: [], newChildNames: [] },
    reminders: { suggestions: [{ minutesBefore: 120, label: '2h' }] },
    userMessage: 'Gotovo.',
  });
}

const okCaller: GroqCall = async () => ({ ok: true, content: suggestionsFor('match') });
const failingCaller: GroqCall = async () => ({
  ok: false,
  reason: 'rate-limited',
  message: 'quota exhausted',
  status: 429,
});

let eventId: string;
const queuedIds: string[] = [];

async function enqueue(reason = 'timeout'): Promise<string> {
  const result = await enqueueAiTask({
    eventId,
    familyId: JOVIC_FAMILY_ID,
    requestedBy: JOVIC_TATA_ID,
    input: INPUT,
    reason,
  });
  expect(result).not.toBeNull();
  queuedIds.push(result!.id);
  return result!.id;
}

async function rowOf(id: string) {
  const { data } = await admin
    .from('ai_queue')
    .select('status, result, error, attempts, processed_at')
    .eq('id', id)
    .single();
  return data;
}

describe('ai_queue lifecycle', () => {
  beforeAll(async () => {
    const { data, error } = await admin
      .from('events')
      .insert({
        family_id: JOVIC_FAMILY_ID,
        created_by: JOVIC_TATA_ID,
        title: 'ai-queue-fixture',
        category: 'other',
        start_date: '2031-05-05',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    eventId = data!.id;
  });

  afterAll(async () => {
    if (queuedIds.length) await admin.from('ai_queue').delete().in('id', queuedIds);
    if (eventId) await admin.from('events').delete().eq('id', eventId);
  });

  it('enqueues a pending row carrying a self-contained payload', async () => {
    const id = await enqueue('no response within 3000ms');
    const { data } = await admin.from('ai_queue').select('status, tasks').eq('id', id).single();

    expect(data?.status).toBe('pending');
    // The worker must be able to redo the request without re-deriving context.
    const payload = data?.tasks as ReturnType<typeof buildQueuePayload>;
    expect(payload.requestedBy).toBe(JOVIC_TATA_ID);
    expect(payload.familyId).toBe(JOVIC_FAMILY_ID);
    expect(payload.input.title).toBe('Luka fudbal');
    expect(payload.reason).toContain('3000ms');
  });

  it('writes an audit row when a task is queued', async () => {
    const id = await enqueue();
    const { data } = await admin
      .from('audit_log')
      .select('action, entity')
      .eq('entity_id', id)
      .eq('action', 'ai.queued');
    expect(data?.length).toBeGreaterThan(0);
  });

  it('claims a pending task and moves it to processing', async () => {
    const id = await enqueue();
    const claimed = await claimTask(id);

    expect(claimed?.id).toBe(id);
    expect((await rowOf(id))?.status).toBe('processing');
  });

  it('refuses a second claim on the same task', async () => {
    const id = await enqueue();

    expect(await claimTask(id)).not.toBeNull();
    // The guard against two realtime handlers (or a tab and the cron) racing.
    expect(await claimTask(id)).toBeNull();
  });

  it('lets exactly one of two concurrent claims win', async () => {
    const id = await enqueue();
    const [a, b] = await Promise.all([claimTask(id), claimTask(id)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('processes a task to done and stores the suggestions', async () => {
    const id = await enqueue();
    const outcome = await processQueuedTask(id, { call: okCaller, notify: false });

    expect(outcome.status).toBe('done');
    const row = await rowOf(id);
    expect(row?.status).toBe('done');
    expect(row?.attempts).toBe(1);
    expect(row?.processed_at).not.toBeNull();
    expect(row?.error).toBeNull();
    expect((row?.result as { categorization: { category: string } }).categorization.category).toBe(
      'match',
    );
  });

  it('writes an ai-actor audit row on completion', async () => {
    const id = await enqueue();
    await processQueuedTask(id, { call: okCaller, notify: false });

    const { data } = await admin
      .from('audit_log')
      .select('actor_type, action')
      .eq('entity_id', id)
      .eq('action', 'ai.completed')
      .single();
    expect(data?.actor_type).toBe('ai');
  });

  it('marks the task failed when the model cannot be reached', async () => {
    const id = await enqueue();
    const outcome = await processQueuedTask(id, { call: failingCaller, notify: false });

    expect(outcome.status).toBe('failed');
    const row = await rowOf(id);
    expect(row?.status).toBe('failed');
    expect(row?.error).toContain('quota exhausted');
    expect(row?.attempts).toBe(1);
  });

  it('skips a task that is already being processed', async () => {
    const id = await enqueue();
    await claimTask(id);

    const outcome = await processQueuedTask(id, { call: okCaller, notify: false });
    expect(outcome).toEqual({ status: 'skipped', reason: 'already-claimed' });
  });

  it('fails a row whose payload it cannot understand', async () => {
    const id = await enqueue();
    // Simulate a row written by an older version of the app.
    await admin
      .from('ai_queue')
      .update({ tasks: { version: 99, nonsense: true } as never })
      .eq('id', id);

    const outcome = await processQueuedTask(id, { call: okCaller, notify: false });

    expect(outcome.status).toBe('failed');
    // An unreadable payload will never become readable — it must not be left
    // pending for the retry cron to pick up forever.
    expect((await rowOf(id))?.status).toBe('failed');
  });

  it('lists pending tasks oldest first and omits settled ones', async () => {
    const first = await enqueue('first');
    const second = await enqueue('second');
    await processQueuedTask(first, { call: okCaller, notify: false });

    const pending = await listPendingTasks(50);
    expect(pending).not.toContain(first);
    expect(pending).toContain(second);
  });
});
