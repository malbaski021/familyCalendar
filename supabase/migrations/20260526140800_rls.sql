-- =============================================================================
-- Helper functions used in RLS policies
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_family_member(check_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = check_family_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_family_owner(check_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = check_family_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Family id of a given event (used by event-related table policies)
create or replace function public.event_family_id(check_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.events where id = check_event_id;
$$;

-- =============================================================================
-- users
-- =============================================================================

create policy "users: self or family members or admin can read"
  on public.users for select
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.family_members fm_self
      join public.family_members fm_other using (family_id)
      where fm_self.user_id = auth.uid() and fm_other.user_id = public.users.id
    )
  );

create policy "users: self can update own profile"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

create policy "users: admin can update anyone"
  on public.users for update
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT/DELETE policies: trigger creates rows, auth cascade handles delete.

-- =============================================================================
-- families
-- =============================================================================

create policy "families: members can read"
  on public.families for select
  using (public.is_family_member(id) or public.is_admin());

create policy "families: admin can insert"
  on public.families for insert
  with check (public.is_admin());

create policy "families: owner or admin can update"
  on public.families for update
  using (public.is_family_owner(id) or public.is_admin())
  with check (public.is_family_owner(id) or public.is_admin());

create policy "families: admin can delete"
  on public.families for delete
  using (public.is_admin());

-- =============================================================================
-- family_members
-- =============================================================================

create policy "family_members: visible to other members"
  on public.family_members for select
  using (public.is_family_member(family_id) or public.is_admin());

-- INSERT goes through service-role on invite-link acceptance (no user policy).

create policy "family_members: owner can update roles"
  on public.family_members for update
  using (public.is_family_owner(family_id) or public.is_admin())
  with check (public.is_family_owner(family_id) or public.is_admin());

create policy "family_members: owner can remove or self can leave"
  on public.family_members for delete
  using (
    public.is_family_owner(family_id)
    or user_id = auth.uid()
    or public.is_admin()
  );

-- =============================================================================
-- children
-- =============================================================================

create policy "children: members can read"
  on public.children for select
  using (public.is_family_member(family_id) or public.is_admin());

create policy "children: members can insert"
  on public.children for insert
  with check (public.is_family_member(family_id));

create policy "children: members can update"
  on public.children for update
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "children: members can delete"
  on public.children for delete
  using (public.is_family_member(family_id));

-- =============================================================================
-- invite_links
-- =============================================================================

create policy "invite_links: family members can read own family invites"
  on public.invite_links for select
  using (public.is_family_member(family_id) or public.is_admin());

create policy "invite_links: admin issues owner invites"
  on public.invite_links for insert
  with check (
    (role = 'owner' and public.is_admin())
    or (role = 'member' and public.is_family_owner(family_id))
  );

create policy "invite_links: creator can update (regenerate/revoke)"
  on public.invite_links for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy "invite_links: creator can delete"
  on public.invite_links for delete
  using (created_by = auth.uid() or public.is_admin());

-- =============================================================================
-- events
-- =============================================================================

create policy "events: family members can read"
  on public.events for select
  using (public.is_family_member(family_id) or public.is_admin());

create policy "events: family members can insert"
  on public.events for insert
  with check (public.is_family_member(family_id) and created_by = auth.uid());

create policy "events: family members can update"
  on public.events for update
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "events: family members can delete"
  on public.events for delete
  using (public.is_family_member(family_id));

-- =============================================================================
-- event_children
-- =============================================================================

create policy "event_children: family members can read"
  on public.event_children for select
  using (public.is_family_member(public.event_family_id(event_id)) or public.is_admin());

create policy "event_children: family members can insert"
  on public.event_children for insert
  with check (public.is_family_member(public.event_family_id(event_id)));

create policy "event_children: family members can delete"
  on public.event_children for delete
  using (public.is_family_member(public.event_family_id(event_id)));

-- =============================================================================
-- event_reminders
-- =============================================================================

create policy "event_reminders: family members can read"
  on public.event_reminders for select
  using (public.is_family_member(public.event_family_id(event_id)) or public.is_admin());

create policy "event_reminders: family members can insert"
  on public.event_reminders for insert
  with check (public.is_family_member(public.event_family_id(event_id)));

create policy "event_reminders: family members can update"
  on public.event_reminders for update
  using (public.is_family_member(public.event_family_id(event_id)))
  with check (public.is_family_member(public.event_family_id(event_id)));

create policy "event_reminders: family members can delete"
  on public.event_reminders for delete
  using (public.is_family_member(public.event_family_id(event_id)));

-- =============================================================================
-- event_instances
-- =============================================================================

create policy "event_instances: family members can read"
  on public.event_instances for select
  using (public.is_family_member(public.event_family_id(event_id)) or public.is_admin());

create policy "event_instances: family members can insert"
  on public.event_instances for insert
  with check (public.is_family_member(public.event_family_id(event_id)));

create policy "event_instances: family members can update"
  on public.event_instances for update
  using (public.is_family_member(public.event_family_id(event_id)))
  with check (public.is_family_member(public.event_family_id(event_id)));

create policy "event_instances: family members can delete"
  on public.event_instances for delete
  using (public.is_family_member(public.event_family_id(event_id)));

-- =============================================================================
-- event_shares — public read via token, authed CRUD by family members
-- =============================================================================

create policy "event_shares: anyone can read by token"
  on public.event_shares for select
  using (true);

create policy "event_shares: family members can insert"
  on public.event_shares for insert
  with check (
    public.is_family_member(public.event_family_id(event_id))
    and created_by = auth.uid()
  );

create policy "event_shares: creator can update (open count) or admin"
  on public.event_shares for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy "event_shares: creator can delete"
  on public.event_shares for delete
  using (created_by = auth.uid() or public.is_admin());

-- =============================================================================
-- drafts — strictly per-user
-- =============================================================================

create policy "drafts: owner can read"
  on public.drafts for select
  using (user_id = auth.uid());

create policy "drafts: owner can insert"
  on public.drafts for insert
  with check (user_id = auth.uid());

create policy "drafts: owner can update"
  on public.drafts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "drafts: owner can delete"
  on public.drafts for delete
  using (user_id = auth.uid());

-- =============================================================================
-- audit_log — read-only; everyone can insert their own family's events
-- =============================================================================

create policy "audit_log: admin reads all, members read own family"
  on public.audit_log for select
  using (
    public.is_admin()
    or (family_id is not null and public.is_family_member(family_id))
  );

create policy "audit_log: anyone authenticated can insert"
  on public.audit_log for insert
  with check (auth.uid() is not null);

-- No UPDATE/DELETE policies — audit log is append-only.

-- =============================================================================
-- ai_queue — family members read, insert; service role processes
-- =============================================================================

create policy "ai_queue: family members can read"
  on public.ai_queue for select
  using (public.is_family_member(public.event_family_id(event_id)) or public.is_admin());

create policy "ai_queue: family members can enqueue"
  on public.ai_queue for insert
  with check (public.is_family_member(public.event_family_id(event_id)));

-- UPDATE handled by service-role (status lifecycle) — no user policy.

-- =============================================================================
-- notifications — owner read/delete, server inserts/updates
-- =============================================================================

create policy "notifications: owner can read"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications: owner can delete"
  on public.notifications for delete
  using (user_id = auth.uid());

-- INSERT/UPDATE handled by service-role.

-- =============================================================================
-- push_subscriptions — strictly per-user
-- =============================================================================

create policy "push_subscriptions: owner can read"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_subscriptions: owner can insert"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subscriptions: owner can update"
  on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions: owner can delete"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- =============================================================================
-- weather_cache — family members read/insert/update; no delete
-- =============================================================================

create policy "weather_cache: family members can read"
  on public.weather_cache for select
  using (public.is_family_member(public.event_family_id(event_id)) or public.is_admin());

create policy "weather_cache: family members can insert"
  on public.weather_cache for insert
  with check (public.is_family_member(public.event_family_id(event_id)));

create policy "weather_cache: family members can update"
  on public.weather_cache for update
  using (public.is_family_member(public.event_family_id(event_id)))
  with check (public.is_family_member(public.event_family_id(event_id)));
