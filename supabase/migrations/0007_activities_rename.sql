-- Renombra processes -> activities y agrega el flujo de aprobación de
-- actividades eventuales sugeridas por colaboradoras.

alter table public.processes rename to activities;
alter index processes_pkey rename to activities_pkey;
alter index processes_client_id_idx rename to activities_client_id_idx;
alter table public.activities rename constraint processes_client_id_fkey to activities_client_id_fkey;

alter table public.activities
  add column tipo text not null default 'recurrente' check (tipo in ('recurrente', 'eventual')),
  add column mes_aplicable date,
  add column estado_aprobacion text not null default 'aprobada'
    check (estado_aprobacion in ('aprobada', 'pendiente', 'rechazada')),
  add column sugerida_por uuid references public.users (id) on delete set null;

alter table public.activities
  add constraint activities_mes_aplicable_only_eventual
    check (tipo = 'eventual' or mes_aplicable is null),
  add constraint activities_mes_aplicable_is_month_start
    check (mes_aplicable is null or extract(day from mes_aplicable) = 1);

create index activities_estado_aprobacion_idx on public.activities (estado_aprobacion)
  where estado_aprobacion = 'pendiente';
create index activities_client_estado_idx on public.activities (client_id, estado_aprobacion);

-- Normaliza estado_aprobacion/sugerida_por según quién crea la fila. No se
-- confía en el payload del cliente: si no es admin, se fuerza 'pendiente' +
-- sugerida_por=auth.uid() y se exige tipo='eventual' con mes_aplicable, sin
-- importar qué haya mandado el formulario. Corre antes de que RLS evalúe
-- WITH CHECK, así que la policy de INSERT puede confiar en la fila ya
-- normalizada.
create or replace function public.set_activity_approval_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.estado_aprobacion := 'pendiente';
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

create trigger activities_before_insert_approval
  before insert on public.activities
  for each row execute function public.set_activity_approval_defaults();
