-- Notification log (F10) — every push notification is recorded with status.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  type text not null, -- 'event_reminder', 'ai_complete', 'draft_warning', 'lock_released', etc.
  payload jsonb not null,
  status public.notification_status not null default 'queued',
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id);
create index idx_notifications_scheduled on public.notifications (scheduled_at) where status = 'queued';
create index idx_notifications_status on public.notifications (status);

alter table public.notifications enable row level security;

-- Browser push subscription store (F10). One row per device per user.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  subscription_data jsonb not null,
  device_type text, -- 'android', 'ios', 'desktop'
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Open-Meteo forecast cache (F12). Keyed by event + forecast date.
create table public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  forecast_date date not null,
  forecast_data jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (event_id, forecast_date)
);

create index idx_weather_cache_event on public.weather_cache (event_id);
create index idx_weather_cache_date on public.weather_cache (forecast_date);

alter table public.weather_cache enable row level security;
