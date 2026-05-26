-- Public read-only share links for events (F13)
create table public.event_shares (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token text not null unique,
  opens_count integer not null default 0,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index idx_event_shares_token on public.event_shares (token);
create index idx_event_shares_event on public.event_shares (event_id);

alter table public.event_shares enable row level security;

-- Auto-saved drafts when an edit lock times out (F8)
create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  draft_data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index idx_drafts_user on public.drafts (user_id);
create index idx_drafts_expires on public.drafts (expires_at);

create trigger drafts_set_updated_at
  before update on public.drafts
  for each row execute function public.set_updated_at();

alter table public.drafts enable row level security;
