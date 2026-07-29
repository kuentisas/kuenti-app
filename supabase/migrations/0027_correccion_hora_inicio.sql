-- Hasta ahora "Solicitar corrección" solo permitía corregir la hora de
-- fin. Bug real reportado: una colaboradora quería corregir tanto inicio
-- como fin (motivo: "la reunión inició a las 2:30 hasta las 3:17 pm"),
-- pero el único campo disponible era "hora de fin correcta" — al escribir
-- la hora de inicio real ahí (anterior al start_time ya guardado), la
-- policy de INSERT la rechazaba con el mensaje crudo de RLS. Esta
-- migración agrega un campo opcional para corregir también la hora de
-- inicio, en la misma solicitud, sin tocar el flujo de aprobación.

alter table public.activity_corrections
  add column nueva_hora_inicio_sugerida timestamptz,
  add column hora_inicio_original timestamptz;

-- Captura hora_inicio_original al crear la solicitud, igual criterio que
-- hora_fin_original (0024): antes de que approve_correction pueda
-- sobreescribir time_entries.start_time, para poder auditar qué cambió.
create or replace function public.set_correction_hora_original()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select start_time, end_time into new.hora_inicio_original, new.hora_fin_original
  from public.time_entries
  where id = new.time_entry_id;
  return new;
end;
$$;

-- La policy original solo comparaba nueva_hora_fin_sugerida contra el
-- start_time ya guardado. Ahora nueva_hora_inicio_sugerida es opcional
-- (null = "no se corrige el inicio", mismo comportamiento de antes vía
-- coalesce): cuando viene, valida que inicio <= fin y que ambos caigan en
-- el pasado, en vez de fijar el inicio al valor ya existente.
drop policy "activity_corrections_insert_own" on public.activity_corrections;
create policy "activity_corrections_insert_own"
  on public.activity_corrections for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.time_entries te
      where te.id = time_entry_id
        and te.user_id = auth.uid()
        and te.end_time is not null
        and nueva_hora_fin_sugerida <= now()
        and coalesce(nueva_hora_inicio_sugerida, te.start_time) <= nueva_hora_fin_sugerida
        and coalesce(nueva_hora_inicio_sugerida, te.start_time) <= now()
    )
  );

-- approve_correction (0021) aplicaba solo end_time. Ahora también aplica
-- start_time cuando la solicitud trae nueva_hora_inicio_sugerida (si no,
-- coalesce deja el start_time tal cual, mismo comportamiento de antes).
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
