-- Row Level Security: admin ve todo, colaboradora solo lo suyo/asignado.

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.processes enable row level security;
alter table public.client_assignments enable row level security;
alter table public.time_entries enable row level security;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy "users_select_self_or_admin"
  on public.users for select
  using (public.is_admin() or id = auth.uid());

create policy "users_insert_admin"
  on public.users for insert
  with check (public.is_admin());

create policy "users_update_admin"
  on public.users for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "users_delete_admin"
  on public.users for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create policy "clients_select_admin_or_assigned"
  on public.clients for select
  using (public.is_admin() or public.is_assigned_to_client(id));

create policy "clients_insert_admin"
  on public.clients for insert
  with check (public.is_admin());

create policy "clients_update_admin"
  on public.clients for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "clients_delete_admin"
  on public.clients for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- processes
-- ---------------------------------------------------------------------------
create policy "processes_select_admin_or_assigned"
  on public.processes for select
  using (public.is_admin() or public.is_assigned_to_client(client_id));

create policy "processes_insert_admin"
  on public.processes for insert
  with check (public.is_admin());

create policy "processes_update_admin"
  on public.processes for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "processes_delete_admin"
  on public.processes for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- client_assignments
-- ---------------------------------------------------------------------------
create policy "client_assignments_select_admin_or_own"
  on public.client_assignments for select
  using (public.is_admin() or user_id = auth.uid());

create policy "client_assignments_insert_admin"
  on public.client_assignments for insert
  with check (public.is_admin());

create policy "client_assignments_update_admin"
  on public.client_assignments for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "client_assignments_delete_admin"
  on public.client_assignments for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------------------
create policy "time_entries_select_admin_or_own"
  on public.time_entries for select
  using (public.is_admin() or user_id = auth.uid());

create policy "time_entries_insert_admin_or_own_assigned"
  on public.time_entries for insert
  with check (
    public.is_admin()
    or (user_id = auth.uid() and public.is_assigned_to_client(client_id))
  );

create policy "time_entries_update_admin_or_own_assigned"
  on public.time_entries for update
  using (public.is_admin() or user_id = auth.uid())
  with check (
    public.is_admin()
    or (user_id = auth.uid() and public.is_assigned_to_client(client_id))
  );

-- Solo admin puede borrar registros de tiempo; preserva integridad del historial.
create policy "time_entries_delete_admin"
  on public.time_entries for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
create policy "app_settings_select_admin"
  on public.app_settings for select
  using (public.is_admin());

create policy "app_settings_update_admin"
  on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());
