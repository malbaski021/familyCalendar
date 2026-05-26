-- Profile table extending auth.users. Supabase Auth owns email + password_hash;
-- this table holds app-level profile data (username, language, role, status).

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (length(username) >= 3),
  language text not null default 'en' check (language in ('en', 'sr-Latn')),
  role public.user_role not null default 'user',
  status public.user_status not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_status on public.users (status);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create profile when an auth user signs up.
-- Reads username from raw_user_meta_data (set by the signup form),
-- falls back to the local-part of the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.users enable row level security;

comment on table public.users is 'Profile data linked to Supabase Auth users';
