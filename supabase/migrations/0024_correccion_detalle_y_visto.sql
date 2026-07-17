-- Dos mejoras al flujo de correcciones de tiempo:
--
-- 1) Auditoría real en /admin/aprobaciones: hoy no se puede ver qué hora
--    tenía el registro antes de la corrección, porque approve_correction
--    (0012) sobreescribe time_entries.end_time con el valor sugerido. Se
--    captura la hora original al momento de crear la solicitud (antes de
--    que se pueda perder), vía trigger — no se confía en el cliente para
--    esto, mismo criterio que set_activity_approval_defaults (0023).
--    Nota: las correcciones ya aprobadas antes de esta migración quedan
--    con hora_fin_original en null — ese dato ya no existe en ningún
--    lado, no se inventa.
--
-- 2) La colaboradora no se entera cuando su corrección se resuelve.
--    visto_por_solicitante se pone en true cuando ella ve el detalle en
--    /panel (vía mark_corrections_seen) — sin notificaciones push/email,
--    solo un badge que se limpia al abrir.

alter table public.activity_corrections
  add column hora_fin_original timestamptz,
  add column visto_por_solicitante boolean not null default false;

create or replace function public.set_correction_hora_original()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select end_time into new.hora_fin_original
  from public.time_entries
  where id = new.time_entry_id;
  return new;
end;
$$;

create trigger trg_set_correction_hora_original
  before insert on public.activity_corrections
  for each row execute function public.set_correction_hora_original();

-- security definer: activity_corrections no tiene grant de UPDATE para
-- authenticated/service_role (ver 0015) a propósito — la única forma de
-- tocar la tabla es a través de funciones puntuales como esta, cada una
-- restringida a exactamente lo que le corresponde (acá: solo marcar como
-- vistas las propias correcciones ya resueltas).
create or replace function public.mark_corrections_seen()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.activity_corrections
    set visto_por_solicitante = true
    where user_id = auth.uid()
      and estado <> 'pendiente'
      and visto_por_solicitante = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_corrections_seen() to authenticated;
