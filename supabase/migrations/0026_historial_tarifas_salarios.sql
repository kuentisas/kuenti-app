-- Historial de vigencia para tarifas de clientes y salarios de
-- colaboradoras. Hallazgo de auditoría: client_rates/user_salaries
-- guardaban un solo valor "actual" sin fecha de vigencia, así que subir
-- una tarifa o un salario HOY distorsionaba retroactivamente la
-- rentabilidad de TODOS los meses ya cerrados (verificado en vivo:
-- cambiar la tarifa cambiaba el costo calculado de un mes cerrado meses
-- atrás). Se reemplazan ambas tablas por historiales append-only.
--
-- Diseño: cada fila dice desde qué mes aplica un valor (vigente_desde,
-- siempre primer día de mes) — sin "vigente_hasta". El valor vigente en
-- un mes es siempre la fila con vigente_desde más reciente que no sea
-- posterior a ese mes. Efecto secundario intencional: corregir un mes
-- corrige también los meses posteriores que no tuvieran su propio
-- cambio explícito, hasta el próximo cambio real — para una excepción
-- de un solo mes, se corrige ese mes Y el siguiente (revirtiendo).

drop trigger if exists on_client_created on public.clients;
drop trigger if exists on_user_created_salary_row on public.users;
drop function if exists public.handle_new_client();
drop function if exists public.handle_new_user_salary_row();
drop table if exists public.client_rates cascade;
drop table if exists public.user_salaries cascade;

create table public.client_rate_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  tarifa_mensual numeric(14, 2) not null check (tarifa_mensual >= 0),
  vigente_desde date not null check (extract(day from vigente_desde) = 1),
  es_correccion boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, vigente_desde)
);

create index client_rate_history_client_id_idx on public.client_rate_history (client_id);

create table public.user_salary_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  salario_mensual numeric(14, 2) not null check (salario_mensual >= 0),
  vigente_desde date not null check (extract(day from vigente_desde) = 1),
  es_correccion boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, vigente_desde)
);

create index user_salary_history_user_id_idx on public.user_salary_history (user_id);

alter table public.client_rate_history enable row level security;
create policy "client_rate_history_select_admin"
  on public.client_rate_history for select
  using (public.is_admin());

alter table public.user_salary_history enable row level security;
create policy "user_salary_history_select_admin"
  on public.user_salary_history for select
  using (public.is_admin());

-- Sin policy de insert/update/delete a propósito: el único camino para
-- escribir son las 4 funciones de abajo (security definer, dueñas del
-- owner de la base) — así ni un cliente ni un bug puede mandar un
-- vigente_desde arbitrario o falsear es_correccion.
grant select on public.client_rate_history to authenticated, service_role;
grant select on public.user_salary_history to authenticated, service_role;

-- Camino normal: siempre hacia adelante. El primer valor jamás fijado
-- para un cliente aplica desde el mes actual (no es un "cambio" a algo
-- existente); cualquier valor posterior aplica desde el mes SIGUIENTE,
-- nunca a mitad del mes en curso. El "on conflict" cubre editar dos
-- veces en el mismo mes antes de que el cambio anterior entre en
-- vigencia: la segunda edición reemplaza a la pendiente, no duplica.
create or replace function public.set_client_tarifa(p_client_id uuid, p_tarifa_mensual numeric)
returns public.client_rate_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes_actual date := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  v_vigente_desde date;
  v_result public.client_rate_history;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede editar la tarifa de un cliente' using errcode = '42501';
  end if;

  if exists (select 1 from public.client_rate_history where client_id = p_client_id) then
    v_vigente_desde := (v_mes_actual + interval '1 month')::date;
  else
    v_vigente_desde := v_mes_actual;
  end if;

  insert into public.client_rate_history (client_id, tarifa_mensual, vigente_desde, es_correccion, created_by)
  values (p_client_id, p_tarifa_mensual, v_vigente_desde, false, auth.uid())
  on conflict (client_id, vigente_desde) do update
    set tarifa_mensual = excluded.tarifa_mensual, es_correccion = false, created_by = auth.uid(), created_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

-- Corrección retroactiva: solo admin, mes explícito, nunca futuro (para
-- futuro se usa set_client_tarifa).
create or replace function public.correct_client_tarifa_historico(
  p_client_id uuid, p_tarifa_mensual numeric, p_vigente_desde date
)
returns public.client_rate_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes_actual date := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  v_result public.client_rate_history;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede corregir el historial de tarifas' using errcode = '42501';
  end if;
  if extract(day from p_vigente_desde) <> 1 then
    raise exception 'vigente_desde debe ser el primer día de un mes' using errcode = '22023';
  end if;
  if p_vigente_desde > v_mes_actual then
    raise exception 'No se puede corregir un mes futuro — para eso se usa el cambio normal' using errcode = '22023';
  end if;

  insert into public.client_rate_history (client_id, tarifa_mensual, vigente_desde, es_correccion, created_by)
  values (p_client_id, p_tarifa_mensual, p_vigente_desde, true, auth.uid())
  on conflict (client_id, vigente_desde) do update
    set tarifa_mensual = excluded.tarifa_mensual, es_correccion = true, created_by = auth.uid(), created_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

-- Mismo par de funciones para salario.
create or replace function public.set_user_salario(p_user_id uuid, p_salario_mensual numeric)
returns public.user_salary_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes_actual date := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  v_vigente_desde date;
  v_result public.user_salary_history;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede editar el salario de un miembro del equipo' using errcode = '42501';
  end if;

  if exists (select 1 from public.user_salary_history where user_id = p_user_id) then
    v_vigente_desde := (v_mes_actual + interval '1 month')::date;
  else
    v_vigente_desde := v_mes_actual;
  end if;

  insert into public.user_salary_history (user_id, salario_mensual, vigente_desde, es_correccion, created_by)
  values (p_user_id, p_salario_mensual, v_vigente_desde, false, auth.uid())
  on conflict (user_id, vigente_desde) do update
    set salario_mensual = excluded.salario_mensual, es_correccion = false, created_by = auth.uid(), created_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.correct_user_salario_historico(
  p_user_id uuid, p_salario_mensual numeric, p_vigente_desde date
)
returns public.user_salary_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes_actual date := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  v_result public.user_salary_history;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede corregir el historial de salarios' using errcode = '42501';
  end if;
  if extract(day from p_vigente_desde) <> 1 then
    raise exception 'vigente_desde debe ser el primer día de un mes' using errcode = '22023';
  end if;
  if p_vigente_desde > v_mes_actual then
    raise exception 'No se puede corregir un mes futuro — para eso se usa el cambio normal' using errcode = '22023';
  end if;

  insert into public.user_salary_history (user_id, salario_mensual, vigente_desde, es_correccion, created_by)
  values (p_user_id, p_salario_mensual, p_vigente_desde, true, auth.uid())
  on conflict (user_id, vigente_desde) do update
    set salario_mensual = excluded.salario_mensual, es_correccion = true, created_by = auth.uid(), created_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.set_client_tarifa(uuid, numeric) to authenticated;
grant execute on function public.correct_client_tarifa_historico(uuid, numeric, date) to authenticated;
grant execute on function public.set_user_salario(uuid, numeric) to authenticated;
grant execute on function public.correct_user_salario_historico(uuid, numeric, date) to authenticated;
