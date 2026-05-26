-- Family groups
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_families_slug on public.families (slug);
create index idx_families_created_by on public.families (created_by);

create trigger families_set_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

alter table public.families enable row level security;

-- Membership: who belongs to which family and in what role
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.family_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index idx_family_members_family on public.family_members (family_id);
create index idx_family_members_user on public.family_members (user_id);

alter table public.family_members enable row level security;

-- Children belonging to a family (used for event tagging)
create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_children_family on public.children (family_id);

create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

alter table public.children enable row level security;
