-- Super-admin enforcement: exactly one user can ever hold role='admin', and only
-- the one whose auth.users.email matches the hardcoded value below. The matching
-- application-level constant lives in src/lib/auth/super-admin.ts — keep them in
-- sync if it ever changes.
--
-- The trigger fires BEFORE INSERT or BEFORE UPDATE OF role, so:
--   - The auto-created `public.users` row (via handle_new_user) can keep its
--     default role='user' regardless of email.
--   - Demoting the admin back to 'user' is allowed (we only block transitions
--     INTO 'admin').
--   - Any attempt to set role='admin' for a different email or a second user
--     raises an exception and aborts the transaction.

create or replace function public.enforce_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  user_email text;
  other_admin_count integer;
begin
  if new.role <> 'admin' then
    return new;
  end if;

  select email into user_email from auth.users where id = new.id;
  if user_email is null or lower(user_email) <> 'malbaski.ns@gmail.com' then
    raise exception 'admin role is reserved for the super-admin email'
      using errcode = 'check_violation';
  end if;

  select count(*) into other_admin_count
    from public.users
    where role = 'admin' and id <> new.id;
  if other_admin_count > 0 then
    raise exception 'admin role is singleton — another admin already exists'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_super_admin on public.users;
create trigger users_enforce_super_admin
  before insert or update of role on public.users
  for each row execute function public.enforce_super_admin();
