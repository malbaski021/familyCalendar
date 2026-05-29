-- Track whether a user has finished the post-invite onboarding flow.
-- NULL = pending, timestamp = completed at that moment.
-- "Relaunch onboarding" simply nulls this back to NULL so the next entry
-- to a protected page sends the user through the wizard again.

alter table public.users
  add column if not exists onboarded_at timestamptz;

create index if not exists idx_users_onboarded_at_pending
  on public.users (id)
  where onboarded_at is null;
