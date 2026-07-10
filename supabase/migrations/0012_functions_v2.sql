-- Reemplaza start_timer/stop_timer (0005) por el nuevo set de funciones que
-- implementan: un solo timer global activo por usuario, bloqueo cruzado
-- entre usuarios en la misma actividad, recuperación de timers huérfanos, y
-- aprobación/rechazo atómico de correcciones.

drop function if exists public.start_timer(uuid, uuid);
drop function if exists public.stop_timer();

-- security definer: necesita ver el nombre y la fila activa de OTRO usuario
-- para poder mostrar "María ya está trabajando en esto desde las 10:00am" —
-- bajo RLS normal (invocador), esa fila sería invisible para la colaboradora
-- que llama, y el mensaje no se podría construir.
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

  -- OJO: nunca comparar un record entero con IS NULL/IS NOT NULL. Para un
  -- ROW/RECORD, "x IS NULL" es true solo si TODOS los campos son null, e
  -- "IS NOT NULL" solo si TODOS son no-null (semántica SQL de comparación de
  -- filas) — no significa "¿se encontró una fila?". Como varias de estas
  -- filas tienen columnas nullable (mes_aplicable, end_time de un timer
  -- activo, nota_ajuste, etc.), casi siempre son "mixtas" y ambas
  -- comparaciones dan false aunque la fila sí se haya encontrado. El chequeo
  -- correcto es sobre un campo escalar garantizado NOT NULL, como id.
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
     and v_activity.mes_aplicable <> date_trunc('month', now())::date then
    raise exception 'La actividad eventual no corresponde al mes actual' using errcode = '22023';
  end if;

  -- Bloquea cualquier fila activa existente en esta actividad (de cualquier
  -- usuario) para serializar llamadas concurrentes a start_activity sobre la
  -- MISMA actividad y cerrar la ventana de carrera check-then-insert.
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

  -- Detiene automáticamente cualquier timer propio activo (regla: un solo
  -- timer global por usuario, no por cliente), donde sea que esté.
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

-- security invoker: solo toca la fila propia del que llama, no necesita ver
-- datos de otros usuarios.
create or replace function public.stop_activity(p_nota_ajuste text default null)
returns public.time_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry public.time_entries;
begin
  update public.time_entries
    set end_time = now(), estado = 'finalizado',
        nota_ajuste = coalesce(p_nota_ajuste, nota_ajuste)
    where user_id = auth.uid() and end_time is null
    returning * into v_entry;

  if v_entry.id is null then
    raise exception 'No tienes un timer activo' using errcode = 'KU002';
  end if;
  return v_entry;
end;
$$;

-- Para el modal obligatorio de recuperación al reconectar/cambiar de
-- dispositivo. p_choice='seguido' cierra con now()/finalizado (opción A:
-- "seguí trabajando todo este tiempo"). p_choice='ajustado' cierra con la
-- hora indicada/ajustado_manualmente (opciones B y C del modal).
create or replace function public.resolve_stale_timer(
  p_choice text,
  p_actual_end_time timestamptz default null,
  p_nota_ajuste text default null
) returns public.time_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_active record;
  v_entry public.time_entries;
begin
  if p_choice not in ('seguido', 'ajustado') then
    raise exception 'Opción inválida: %', p_choice using errcode = '22023';
  end if;

  select * into v_active from public.time_entries
    where user_id = auth.uid() and end_time is null for update;

  if v_active.id is null then
    raise exception 'No tienes un timer activo para resolver' using errcode = 'KU002';
  end if;

  if p_choice = 'seguido' then
    update public.time_entries set end_time = now(), estado = 'finalizado'
      where id = v_active.id returning * into v_entry;
  else
    if p_actual_end_time is null then
      raise exception 'p_actual_end_time es obligatorio cuando p_choice = ajustado' using errcode = '22023';
    end if;
    if p_actual_end_time < v_active.start_time or p_actual_end_time > now() then
      raise exception 'La hora de fin debe estar entre el inicio del timer y ahora' using errcode = '22023';
    end if;
    update public.time_entries
      set end_time = p_actual_end_time, estado = 'ajustado_manualmente', nota_ajuste = p_nota_ajuste
      where id = v_active.id returning * into v_entry;
  end if;
  return v_entry;
end;
$$;

-- security definer + chequeo is_admin() interno: aplica el cambio a
-- time_entries y actualiza activity_corrections de forma atómica en la
-- misma transacción. Es la única puerta para cambiar el estado de una
-- corrección (ver 0010): no hay policy de UPDATE en la tabla, así que ni
-- siquiera un admin puede tocarla con un UPDATE directo desde el cliente.
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
  if not public.is_admin() then
    raise exception 'Solo un administrador puede aprobar correcciones' using errcode = '42501';
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
  if not public.is_admin() then
    raise exception 'Solo un administrador puede rechazar correcciones' using errcode = '42501';
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

-- Target del cron (0013). security definer + revoke all from public (ver
-- 0015): nadie con rol authenticated puede invocarla directamente, ni
-- siquiera service_role — solo el propio job de pg_cron.
create or replace function public.auto_close_stale_timers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.time_entries
    set end_time = start_time + interval '12 hours',
        estado = 'cerrado_automaticamente',
        nota_ajuste = coalesce(nota_ajuste, 'Cerrado automáticamente por límite de tiempo')
    where estado = 'activo'
      and start_time < now() - interval '12 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter function public.auto_close_stale_timers() owner to postgres;
