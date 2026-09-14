-- Admin y supervisor pasan a poder operar también como un miembro del
-- equipo más (Start/Stop de actividades, clientes asignados vía
-- client_assignments, horas que cuentan en reportes/rentabilidad) —
-- reorganización operativa real pedida por la gerente. Dos cambios:
--
-- 1) Relaja prevent_role_change_by_non_admin (0021) para permitir el
--    cambio colaboradora<->supervisor cuando quien ejecuta es admin,
--    manteniendo bloqueado *siempre* cualquier cambio que involucre el
--    rol admin (ni promoción ni degradación), incluso si quien ejecuta
--    es admin — el rol admin sigue siendo exclusivamente manual en la
--    base.
-- 2) Quita el bypass de is_admin() en start_activity: de ahora en más,
--    cualquier rol (admin incluido) necesita una fila en
--    client_assignments para iniciar un timer en un cliente — "sin
--    tratamiento especial", igual que supervisor y colaboradora hoy. No
--    se toca la policy RLS de insert en time_entries (ese bypass de
--    is_admin() ahí es el que sostiene los ajustes manuales, una función
--    distinta), ni stop_activity (ya es igual para todos los roles).

create or replace function public.prevent_role_change_by_non_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if old.role = 'admin' or new.role = 'admin' then
      raise exception 'El rol admin no se puede asignar ni quitar desde la aplicación' using errcode = '42501';
    end if;
    if not public.is_admin() then
      raise exception 'Solo un administrador puede cambiar el rol de un usuario' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

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
  if not public.is_assigned_to_client(p_client_id) then
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
