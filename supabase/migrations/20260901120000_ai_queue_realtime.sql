-- F11: background processing of AI tasks that missed the synchronous budget.
--
-- Opt `ai_queue` into the realtime publication so a client already looking at
-- the calendar can pick up a freshly queued task and drive it to completion,
-- the same way `RealtimeEvents` reacts to `events` (migration 20260601120000).
alter publication supabase_realtime add table public.ai_queue;

-- Partial index for the "what still needs doing" query used by the realtime
-- handler and by the F17 retry cron. Only pending rows are ever scanned, and
-- they are drained oldest-first.
create index if not exists idx_ai_queue_pending
  on public.ai_queue (created_at)
  where status = 'pending';
