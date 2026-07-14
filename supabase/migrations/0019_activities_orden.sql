-- Permite reordenar manualmente las actividades de un cliente (antes se
-- mostraban siempre en orden alfabético). El backfill preserva el orden
-- alfabético actual como punto de partida para no reordenar nada visible.
alter table public.activities
  add column orden integer not null default 0;

with numbered as (
  select id, row_number() over (partition by client_id order by nombre) - 1 as rn
  from public.activities
)
update public.activities a
set orden = numbered.rn
from numbered
where numbered.id = a.id;

create index activities_client_orden_idx on public.activities (client_id, orden);
