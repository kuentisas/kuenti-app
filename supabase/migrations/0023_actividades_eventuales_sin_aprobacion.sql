-- La gerente pidió eliminar el paso de aprobación para actividades
-- eventuales sugeridas por colaboradoras: quedan disponibles de
-- inmediato. Confirmado en la base de datos real que hoy no hay
-- ninguna fila con estado_aprobacion = 'pendiente', así que no hace
-- falta backfill.

-- ---------------------------------------------------------------------------
-- Trigger: en vez de dejar la actividad en 'pendiente', la deja
-- 'aprobada' directamente. sugerida_por se sigue guardando (para saber
-- quién la agregó) y las validaciones de tipo/mes_aplicable no cambian.
-- ---------------------------------------------------------------------------
create or replace function public.set_activity_approval_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin_or_supervisor() then
    new.estado_aprobacion := 'aprobada';
    new.sugerida_por := auth.uid();
    if new.tipo <> 'eventual' then
      raise exception 'Las colaboradoras solo pueden sugerir actividades eventuales'
        using errcode = '42501';
    end if;
    if new.mes_aplicable is null then
      raise exception 'mes_aplicable es obligatorio para actividades eventuales sugeridas'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Policy de INSERT: el trigger de arriba corre antes de que se evalúe
-- el with check, así que la fila ya llega con estado_aprobacion =
-- 'aprobada' — hay que aceptar ese valor acá, no 'pendiente'.
-- ---------------------------------------------------------------------------
drop policy "activities_insert_admin_or_suggestion" on public.activities;
create policy "activities_insert_admin_or_suggestion"
  on public.activities for insert
  with check (
    public.is_admin_or_supervisor()
    or (
      tipo = 'eventual'
      and public.is_assigned_to_client(client_id)
      and sugerida_por = auth.uid()
      and estado_aprobacion = 'aprobada'
      and mes_aplicable is not null
    )
  );

-- ---------------------------------------------------------------------------
-- Fix de zona horaria (hallazgo al verificar el corte de mes): la
-- sesión de Postgres corre en UTC, así que date_trunc('month', now())
-- calculaba el mes en UTC en vez de hora Bogotá — una actividad
-- eventual de julio dejaba de verse ~5 horas antes de la medianoche
-- real de Bogotá el 31. AT TIME ZONE 'America/Bogota' lo corrige
-- (offset fijo, Colombia no tiene horario de verano).
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
      and (
        tipo = 'recurrente'
        or mes_aplicable = date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date
      )
    )
    or sugerida_por = auth.uid()
  );

drop policy "time_entries_insert_admin_or_own_assigned" on public.time_entries;
create policy "time_entries_insert_admin_or_own_assigned"
  on public.time_entries for insert
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and public.is_assigned_to_client(client_id)
      and exists (
        select 1 from public.activities a
        where a.id = activity_id and a.client_id = client_id
      )
      and (
        (
          sincronizado_offline = true
          and exists (
            select 1 from public.activities a2
            where a2.id = activity_id
              and a2.activo
              and a2.estado_aprobacion = 'aprobada'
              and (
                a2.tipo = 'recurrente'
                or a2.mes_aplicable = date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date
              )
          )
        )
        or (
          sincronizado_offline = false
          and end_time is not null
          and estado in ('finalizado', 'ajustado_manualmente')
        )
      )
    )
  );

create or replace function public.start_activity(p_client_id uuid, p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity record;
  v_busy record;
  v_prev record;
  v_entry public.time_entries;
  v_result jsonb;
begin
  if not public.is_admin() and not public.is_assigned_to_client(p_client_id) then
    raise exception 'No tienes acceso a este cliente' using errcode = '42501';
  end if;

  select * into v_activity from public.activities where id = p_activity_id for share;
  if v_activity.id is null then
    raise exception 'Actividad no encontrada' using errcode = 'P0002';
  end if;
  if v_activity.client_id <> p_client_id then
    raise exception 'La actividad no pertenece al cliente indicado' using errcode = '22023';
  end if;
  if not v_activity.activo then
    raise exception 'La actividad está inactiva' using errcode = '22023';
  end if;
  if v_activity.estado_aprobacion <> 'aprobada' then
    raise exception 'La actividad no está aprobada' using errcode = '22023';
  end if;
  if v_activity.tipo = 'eventual'
     and v_activity.mes_aplicable <> date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date then
    raise exception 'La actividad eventual no corresponde al mes actual' using errcode = '22023';
  end if;

  select te.*, u.nombre as usuario_nombre into v_busy
  from public.time_entries te
  join public.users u on u.id = te.user_id
  where te.activity_id = p_activity_id and te.end_time is null
  for update of te;

  if v_busy.id is not null and v_busy.user_id <> auth.uid() then
    raise exception using
      errcode = 'KU001',
      message = format('%s ya está trabajando en esta actividad desde las %s',
                        v_busy.usuario_nombre, to_char(v_busy.start_time, 'HH12:MI AM'));
  end if;

  select te.*, c.nombre as cliente_nombre, a.nombre as actividad_nombre into v_prev
  from public.time_entries te
  join public.clients c on c.id = te.client_id
  join public.activities a on a.id = te.activity_id
  where te.user_id = auth.uid() and te.end_time is null
  for update of te;

  if v_prev.id is not null then
    update public.time_entries
      set end_time = now(), estado = 'finalizado'
      where id = v_prev.id;
  end if;

  insert into public.time_entries (user_id, client_id, activity_id, start_time, estado, sincronizado_offline)
  values (auth.uid(), p_client_id, p_activity_id, now(), 'activo', true)
  returning * into v_entry;

  v_result := jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'auto_stopped', case when v_prev.id is null then null else jsonb_build_object(
      'activity_nombre', v_prev.actividad_nombre,
      'client_nombre', v_prev.cliente_nombre,
      'duration_seconds', extract(epoch from (now() - v_prev.start_time))::integer
    ) end
  );
  return v_result;
exception
  when unique_violation then
    raise exception 'Esta actividad ya tiene un timer activo. Intenta de nuevo.' using errcode = 'KU001';
end;
$$;
