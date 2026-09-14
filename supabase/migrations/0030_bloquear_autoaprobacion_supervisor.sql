-- Desde que admin/supervisor pueden operar como miembro del equipo (0029),
-- también pueden generar sus propias solicitudes de corrección de tiempo.
-- approve_correction()/reject_correction() nunca comparaban
-- activity_corrections.user_id (quien solicitó) contra auth.uid() (quien
-- aprueba) — solo validaban is_admin_or_supervisor(), así que cualquiera
-- podía auto-aprobarse. Decisión de producto: admin SÍ puede auto-aprobarse
-- (siempre existe al menos un admin, rol inmutable, así que nunca queda
-- atascado); supervisor NUNCA puede aprobar/rechazar su propia solicitud —
-- necesita otro supervisor o admin.

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

  -- is_admin(), no is_admin_or_supervisor(): admin queda exento del
  -- bloqueo (auto-aprobación permitida); cualquier otro caso que llegue
  -- hasta acá ya pasó el chequeo de arriba, así que solo puede ser
  -- supervisor.
  if not public.is_admin() and v_corr.user_id = auth.uid() then
    raise exception 'Un supervisor no puede aprobar su propia solicitud de corrección — pide que la revise otro supervisor o un administrador.' using errcode = '42501';
  end if;

  if v_corr.estado <> 'pendiente' then
    raise exception 'Esta corrección ya fue revisada' using errcode = '22023';
  end if;

  update public.time_entries
    set start_time = coalesce(v_corr.nueva_hora_inicio_sugerida, start_time),
        end_time = v_corr.nueva_hora_fin_sugerida,
        estado = 'ajustado_manualmente',
        nota_ajuste = v_corr.motivo
    where id = v_corr.time_entry_id
      and coalesce(v_corr.nueva_hora_inicio_sugerida, start_time) <= v_corr.nueva_hora_fin_sugerida
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

  select * into v_corr from public.activity_corrections where id = p_correction_id for update;
  if v_corr.id is null then
    raise exception 'Corrección no encontrada' using errcode = 'P0002';
  end if;

  if not public.is_admin() and v_corr.user_id = auth.uid() then
    raise exception 'Un supervisor no puede rechazar su propia solicitud de corrección — pide que la revise otro supervisor o un administrador.' using errcode = '42501';
  end if;

  if v_corr.estado <> 'pendiente' then
    raise exception 'Esta corrección ya fue revisada' using errcode = '22023';
  end if;

  update public.activity_corrections
    set estado = 'rechazada', revisado_por = auth.uid(), fecha_revision = now(), nota_revision = p_reason
    where id = p_correction_id
    returning * into v_corr;

  return v_corr;
end;
$$;
