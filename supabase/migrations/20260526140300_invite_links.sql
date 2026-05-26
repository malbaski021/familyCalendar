-- Single-use invite tokens. Admin issues Owner invites; Owner issues Member invites.
create table public.invite_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token text not null unique,
  role public.family_member_role not null,
  created_by uuid not null references public.users(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.users(id),
  status public.invite_link_status not null default 'active',
  created_at timestamptz not null default now()
);

create index idx_invite_links_token on public.invite_links (token);
create index idx_invite_links_family on public.invite_links (family_id);
create index idx_invite_links_status on public.invite_links (status) where status = 'active';

alter table public.invite_links enable row level security;
