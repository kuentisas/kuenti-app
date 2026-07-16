-- Rol "supervisor": admin operativo sin visibilidad financiera. Puede
-- gestionar clientes, actividades, aprobaciones, asignaciones y el
-- equipo (salvo eliminar usuarios o crear otro admin/supervisor), pero
-- client_rates, user_salaries y app_settings quedan exactamente igual
-- de admin-only que hoy — este rol nunca se agrega a esas policies.

alter table public.users drop constraint users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('admin', 'supervisor', 'colaboradora'));

-- ---------------------------------------------------------------------------
-- Helper de RLS equivalente a is_admin() pero para "admin o supervisor" —
-- se usa en toda policy operativa; is_admin() se mantiene intacto donde
-- debe seguir siendo exclusivo de admin (client_rates, user_salaries,
-- app_settings, delete de users).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin_or_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'supervisor')
      and u.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Defensa en profundidad: ampliar la policy de UPDATE de users a
-- supervisor (para que pueda desactivar/reactivar) abriría la puerta a
-- que cambie su propio rol o el de cualquiera si algún día se agrega esa
-- funcionalidad. Este trigger lo bloquea sin importar qué cliente
-- (normal o service role) haga el UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_change_by_non_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol de un usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger users_before_update_role_guard
  before update on public.users
  for each row execute function public.prevent_role_change_by_non_admin();

-- ---------------------------------------------------------------------------
-- users: select y update (no delete, eso queda exclusivo de admin).
-- ---------------------------------------------------------------------------
drop policy "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin"
  on public.users for select
  using (public.is_admin_or_supervisor() or id = auth.uid());

drop policy "users_update_admin" on public.users;
create policy "users_update_admin"
  on public.users for update
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
drop policy "clients_select_admin_or_assigned" on public.clients;
create policy "clients_select_admin_or_assigned"
  on public.clients for select
  using (public.is_admin_or_supervisor() or public.is_assigned_to_client(id));

drop policy "clients_insert_admin" on public.clients;
create policy "clients_insert_admin"
  on public.clients for insert
  with check (public.is_admin_or_supervisor());

drop policy "clients_update_admin" on public.clients;
create policy "clients_update_admin"
  on public.clients for update
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

drop policy "clients_delete_admin" on public.clients;
create policy "clients_delete_admin"
  on public.clients for delete
  using (public.is_admin_or_supervisor());

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
drop policy "activities_select_admin_or_scoped" on public.activities;
create policy "activities_select_admin_or_scoped"
  on public.activities for select
  using (
    public.is_admin_or_supervisor()
    or (
      public.is_assigned_to_client(client_id)
      and estado_aprobacion = 'aprobada'
      and activo
      and (tipo = 'recurrente' or mes_aplicable = date_trunc('month', now())::date)
    )
    or sugerida_por = auth.uid()
  );

drop policy "activities_insert_admin_or_suggestion" on public.activities;
create policy "activities_insert_admin_or_suggestion"
  on public.activities for insert
  with check (
    public.is_admin_or_supervisor()
    or (
      tipo = 'eventual'
      and public.is_assigned_to_client(client_id)
      and sugerida_por = auth.uid()
      and estado_aprobacion = 'pendiente'
      and mes_aplicable is not null
    )
  );

drop policy "activities_update_admin" on public.activities;
create policy "activities_update_admin"
  on public.activities for update
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

drop policy "activities_delete_admin" on public.activities;
create policy "activities_delete_admin"
  on public.activities for delete
  using (public.is_admin_or_supervisor());

-- ---------------------------------------------------------------------------
-- client_assignments
-- ---------------------------------------------------------------------------
drop policy "client_assignments_select_admin_or_own" on public.client_assignments;
create policy "client_assignments_select_admin_or_own"
  on public.client_assignments for select
  using (public.is_admin_or_supervisor() or user_id = auth.uid());

drop policy "client_assignments_insert_admin" on public.client_assignments;
create policy "client_assignments_insert_admin"
  on public.client_assignments for insert
  with check (public.is_admin_or_supervisor());

drop policy "client_assignments_update_admin" on public.client_assignments;
create policy "client_assignments_update_admin"
  on public.client_assignments for update
  using (public.is_admin_or_supervisor())
  with check (public.is_admin_or_supervisor());

drop policy "client_assignments_delete_admin" on public.client_assignments;
create policy "client_assignments_delete_admin"
  on public.client_assignments for delete
  using (public.is_admin_or_supervisor());

-- ---------------------------------------------------------------------------
-- time_entries: solo se amplía SELECT (dashboard, reportes, calendario,
-- historial de aprobaciones). Insert/update/delete se quedan tal cual —
-- el spec del rol no pide que supervisor edite o borre horas de nadie.
-- ---------------------------------------------------------------------------
drop policy "time_entries_select_admin_or_own" on public.time_entries;
create policy "time_entries_select_admin_or_own"
  on public.time_entries for select
  using (public.is_admin_or_supervisor() or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activity_corrections: solo se amplía SELECT (ver pendientes/historial).
-- No hay policy de UPDATE/DELETE — esos cambios solo pasan por las
-- funciones approve_correction/reject_correction (ver más abajo).
-- ---------------------------------------------------------------------------
drop policy "activity_corrections_select_admin_or_own" on public.activity_corrections;
create policy "activity_corrections_select_admin_or_own"
  on public.activity_corrections for select
  using (public.is_admin_or_supervisor() or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- approve_correction / reject_correction (0012) son security definer con
-- su propio chequeo interno de is_admin(), independiente de RLS — hay que
-- editar el cuerpo de las funciones, no solo policies.
-- ---------------------------------------------------------------------------
create or replace function public.approve_correction(p_correction_id uuid)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corr record;
  v_entry public.time_entries;
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Solo un administrador o supervisor puede aprobar correcciones' using errcode = '42501';
  end if;

  select * into v_corr from public.activity_corrections where id = p_correction_id for update;
  if v_corr.id is null then
    raise exception 'Corrección no encontrada' using errcode = 'P0002';
  end if;
  if v_corr.estado <> 'pendiente' then
    raise exception 'Esta corrección ya fue revisada' using errcode = '22023';
  end if;

  update public.time_entries
    set end_time = v_corr.nueva_hora_fin_sugerida,
        estado = 'ajustado_manualmente',
        nota_ajuste = v_corr.motivo
    where id = v_corr.time_entry_id
      and v_corr.nueva_hora_fin_sugerida >= start_time
    returning * into v_entry;

  if v_entry.id is null then
    raise exception 'La hora sugerida no es válida para este registro (anterior al inicio)'
      using errcode = '22023';
  end if;

  update public.activity_corrections
    set estado = 'aprobada', revisado_por = auth.uid(), fecha_revision = now()
    where id = p_correction_id;

  return v_entry;
end;
$$;

create or replace function public.reject_correction(p_correction_id uuid, p_reason text default null)
returns public.activity_corrections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corr public.activity_corrections;
begin
  if not public.is_admin_or_supervisor() then
    raise exception 'Solo un administrador o supervisor puede rechazar correcciones' using errcode = '42501';
  end if;

  update public.activity_corrections
    set estado = 'rechazada', revisado_por = auth.uid(), fecha_revision = now(), nota_revision = p_reason
    where id = p_correction_id and estado = 'pendiente'
    returning * into v_corr;

  if v_corr.id is null then
    raise exception 'Corrección no encontrada o ya revisada' using errcode = 'P0002';
  end if;

  return v_corr;
end;
$$;
