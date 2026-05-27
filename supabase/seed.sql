-- Seed data for local development only. NOT applied to production.
-- Run with: supabase db reset
--
-- Test password for all accounts: `password123`
-- The admin row uses the real super-admin email so the
-- enforce_super_admin trigger (migration 20260527120000_super_admin.sql)
-- allows the role assignment in step 2 below.

-- ---------------------------------------------------------------------------
-- 1. Auth users (Supabase Auth) — trigger auto-creates matching public.users
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
  confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current, reauthentication_token,
  email_change, phone_change, phone_change_token,
  created_at, updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'malbaski.ns@gmail.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"username":"malbaski"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '', '', '', '', '', '', '', '',
    now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'jovic.tata@familycalendar.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"username":"jovic_tata"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '', '', '', '', '', '', '', '',
    now(), now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'jovic.mama@familycalendar.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"username":"jovic_mama"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '', '', '', '', '', '', '', '',
    now(), now()
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'smith.dad@familycalendar.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"username":"smith_dad"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '', '', '', '', '', '', '', '',
    now(), now()
  );

-- GoTrue also needs an auth.identities row per user for password sign-in to work
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'provider', 'email'),
  now(), now(), now()
from auth.users u
where u.email like '%@familycalendar.local'
   or u.email = 'malbaski.ns@gmail.com';

-- ---------------------------------------------------------------------------
-- 2. Promote first user to admin (others stay as default 'user')
-- ---------------------------------------------------------------------------

update public.users
set role = 'admin'
where id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------------------
-- 3. One family
-- ---------------------------------------------------------------------------

insert into public.families (id, name, slug, created_by) values
  (
    '44444444-4444-4444-4444-444444444444',
    'Jovic Family',
    'jovic-porodica-a3x9k',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'Smith Family',
    'smith-family-b7k2p',
    '11111111-1111-1111-1111-111111111111'
  );

-- ---------------------------------------------------------------------------
-- 4. Family members: tata = owner, mama = member
-- ---------------------------------------------------------------------------

insert into public.family_members (family_id, user_id, role) values
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'member'),
  ('77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888', 'owner');

-- ---------------------------------------------------------------------------
-- 5. Children
-- ---------------------------------------------------------------------------

insert into public.children (id, family_id, name) values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 'Luka'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 'Mila');

-- ---------------------------------------------------------------------------
-- 6. Sample events
-- ---------------------------------------------------------------------------

insert into public.events (
  id, family_id, title, category, start_date, start_time, end_time, location, created_by
) values
  (
    '66666666-6666-6666-6666-666666666661',
    '44444444-4444-4444-4444-444444444444',
    'Luka football match',
    'match',
    current_date + interval '3 days',
    '10:00',
    '12:00',
    'Stadion Kraj Drine',
    '22222222-2222-2222-2222-222222222222'
  ),
  (
    '66666666-6666-6666-6666-666666666662',
    '44444444-4444-4444-4444-444444444444',
    'Mila school performance',
    'performance',
    current_date + interval '7 days',
    '17:00',
    '19:00',
    'Skola "Branko Radicevic"',
    '33333333-3333-3333-3333-333333333333'
  ),
  (
    '66666666-6666-6666-6666-666666666663',
    '44444444-4444-4444-4444-444444444444',
    'Pediatrician check-up',
    'doctor',
    current_date + interval '14 days',
    '09:30',
    null,
    'Dom zdravlja',
    '33333333-3333-3333-3333-333333333333'
  );

-- Tag the right children on each event
insert into public.event_children (event_id, child_id) values
  ('66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551'),
  ('66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555552'),
  ('66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555551'),
  ('66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555552');

-- One event in Smith family — used by integration tests to verify cross-family RLS
insert into public.events (
  id, family_id, title, category, start_date, start_time, end_time, created_by
) values
  (
    '99999999-9999-9999-9999-999999999991',
    '77777777-7777-7777-7777-777777777777',
    'Smith family birthday',
    'birthday',
    current_date + interval '5 days',
    '14:00',
    '18:00',
    '88888888-8888-8888-8888-888888888888'
  );
