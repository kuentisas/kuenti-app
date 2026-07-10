-- Expande time_entries: estado explícito, notas de ajuste, soporte offline,
-- flag de conflicto, y el bloqueo cruzado "una actividad, un timer activo".

alter table public.time_entries rename column process_id to activity_id;
alter table public.time_entries rename constraint time_entries_process_id_fkey to time_entries_activity_id_fkey;
alter index time_entries_process_id_idx rename to time_entries_activity_id_idx;

alter table public.time_entries add column nota_ajuste text;
alter table public.time_entries add column sincronizado_offline boolean not null default true;
alter table public.time_entries add column tiene_conflicto boolean not null default false;

-- estado se backfillea ANTES de ponerle NOT NULL + CHECK: agregar esas
-- restricciones en un solo paso haría que las filas ya finalizadas violen
-- el default 'activo'.
alter table public.time_entries add column estado text;
update public.time_entries
  set estado = case when end_time is null then 'activo' else 'finalizado' end;
alter table public.time_entries alter column estado set not null;
alter table public.time_entries alter column estado set default 'activo';
alter table public.time_entries
  add constraint time_entries_estado_check
    check (estado in ('activo', 'finalizado', 'cerrado_automaticamente', 'ajustado_manualmente'));

-- Invariante estado <-> end_time como CHECK declarativo (no trigger): se
-- aplica automáticamente en cualquier camino de escritura, sin depender de
-- que alguien recuerde engancharlo a un trigger. El índice único parcial
-- time_entries_one_active_per_user_idx (creado en 0001) sigue siendo válido
-- tal cual, ya que estado='activo' ahora es equivalente a end_time is null.
alter table public.time_entries
  add constraint time_entries_estado_end_time_sync
    check ((estado = 'activo') = (end_time is null));

-- Un registro sincronizado_offline=false es, por definición, una sesión ya
-- terminada que se sube después de reconectar: nunca puede representar un
-- timer todavía corriendo.
alter table public.time_entries
  add constraint time_entries_offline_requires_end
    check (sincronizado_offline = true or end_time is not null);

create index time_entries_estado_idx on public.time_entries (estado);
create index time_entries_tiene_conflicto_idx on public.time_entries (id) where tiene_conflicto;

-- Un solo timer activo por actividad (cualquier usuario) — cierra la
-- ventana de carrera "check-then-insert" del bloqueo cruzado entre usuarios.
create unique index time_entries_one_active_per_activity_idx
  on public.time_entries (activity_id)
  where end_time is null;

-- Marca tiene_conflicto cuando un registro offline se solapa en tiempo con
-- el de otro usuario en la misma actividad. security definer: necesita ver
-- filas de otros usuarios para detectar el solapamiento, algo que bajo RLS
-- normal (invocador) sería invisible para una colaboradora.
create or replace function public.detect_offline_conflict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sincronizado_offline = false then
    if exists (
      select 1 from public.time_entries te
      where te.activity_id = new.activity_id
        and te.user_id <> new.user_id
        and te.start_time < coalesce(new.end_time, 'infinity'::timestamptz)
        and coalesce(te.end_time, 'infinity'::timestamptz) > new.start_time
    ) then
      new.tiene_conflicto := true;
    end if;
  end if;
  return new;
end;
$$;

create trigger time_entries_before_insert_offline_conflict
  before insert on public.time_entries
  for each row execute function public.detect_offline_conflict();
