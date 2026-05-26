-- Read-only activity log of every user/AI/system action (F9)
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  actor_type public.audit_actor_type not null,
  actor_id uuid references public.users(id),
  action text not null, -- e.g. 'event.created', 'invite_link.used'
  entity text not null, -- e.g. 'events'
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_family on public.audit_log (family_id);
create index idx_audit_log_actor on public.audit_log (actor_id);
create index idx_audit_log_created on public.audit_log (created_at desc);
create index idx_audit_log_entity on public.audit_log (entity, entity_id);

alter table public.audit_log enable row level security;

-- Async AI tasks queue (F11). Sync Groq call falls through here on timeout/failure.
create table public.ai_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  tasks jsonb not null,
  status public.ai_queue_status not null default 'pending',
  result jsonb,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_ai_queue_status on public.ai_queue (status);
create index idx_ai_queue_event on public.ai_queue (event_id);
create index idx_ai_queue_pending on public.ai_queue (created_at) where status = 'pending';

alter table public.ai_queue enable row level security;
