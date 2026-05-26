-- Main events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  -- Core fields
  title text not null,
  category public.event_category not null default 'other',
  start_date date not null,
  end_date date,
  start_time time, -- null = all-day
  end_time time,
  location text,
  notes text,

  -- Recurring (F7)
  recurring_pattern public.recurring_pattern,
  recurring_end_date date,

  -- Edit locking (F8)
  locked_by uuid references public.users(id),
  locked_at timestamptz,

  -- Audit
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_date is null or end_date >= start_date),
  check (end_time is null or start_time is null or end_time > start_time),
  check (recurring_end_date is null or recurring_pattern is not null)
);

create index idx_events_family on public.events (family_id);
create index idx_events_start_date on public.events (start_date);
create index idx_events_family_dates on public.events (family_id, start_date);
create index idx_events_locked on public.events (locked_by) where locked_by is not null;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

-- Children tagged on each event (M2M)
create table public.event_children (
  event_id uuid not null references public.events(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  primary key (event_id, child_id)
);

create index idx_event_children_child on public.event_children (child_id);

alter table public.event_children enable row level security;

-- Reminders configured per event (Agent 3 suggests, user confirms)
create table public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  minutes_before integer not null check (minutes_before > 0),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_event_reminders_event on public.event_reminders (event_id);
create index idx_event_reminders_unsent on public.event_reminders (event_id) where sent_at is null;

alter table public.event_reminders enable row level security;

-- Per-occurrence overrides + cancellations for recurring events
create table public.event_instances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  instance_date date not null,
  is_cancelled boolean not null default false,

  -- Optional overrides (null = inherit from master event)
  override_title text,
  override_start_time time,
  override_end_time time,
  override_location text,
  override_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, instance_date)
);

create index idx_event_instances_event on public.event_instances (event_id);
create index idx_event_instances_date on public.event_instances (instance_date);

create trigger event_instances_set_updated_at
  before update on public.event_instances
  for each row execute function public.set_updated_at();

alter table public.event_instances enable row level security;
