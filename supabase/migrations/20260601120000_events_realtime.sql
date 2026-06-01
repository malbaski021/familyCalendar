-- Opt the events table into the supabase_realtime publication so the
-- in-app Realtime subscription (`RealtimeEvents` client component) sees
-- INSERT / UPDATE / DELETE broadcasts.

alter publication supabase_realtime add table public.events;
