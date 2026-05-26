-- Extensions
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Enums

create type public.user_role as enum ('admin', 'user');
create type public.user_status as enum ('active', 'archived');
create type public.family_member_role as enum ('owner', 'member');
create type public.event_category as enum (
  'birthday',
  'performance',
  'match',
  'school',
  'doctor',
  'other'
);
create type public.recurring_pattern as enum ('daily', 'weekly', 'monthly');
create type public.invite_link_status as enum ('active', 'used', 'expired', 'revoked');
create type public.ai_queue_status as enum ('pending', 'processing', 'done', 'failed');
create type public.notification_status as enum ('queued', 'sent', 'failed');
create type public.audit_actor_type as enum ('user', 'ai', 'system');

-- Helper: auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
