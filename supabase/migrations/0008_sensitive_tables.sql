-- Aísla datos sensibles (salarios, tarifas) en tablas separadas con RLS
-- admin-only sin excepción de auto-lectura. Necesario porque admin y
-- colaboradora comparten el mismo rol de Postgres (authenticated): RLS no
-- puede ocultar columnas dentro de una fila que su propio dueño puede leer.

create table public.client_rates (
  client_id uuid primary key references public.clients (id) on delete cascade,
  tarifa_mensual numeric(14, 2) check (tarifa_mensual >= 0),
  updated_at timestamptz not null default now()
);

create table public.user_salaries (
  user_id uuid primary key references public.users (id) on delete cascade,
  salario_mensual numeric(14, 2) check (salario_mensual >= 0),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.client_rates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_salaries
  for each row execute function public.set_updated_at();

-- Backfill antes de dropear la columna vieja: conserva las tarifas ya cargadas.
insert into public.client_rates (client_id, tarifa_mensual, updated_at)
  select id, tarifa_mensual, updated_at from public.clients;

alter table public.clients drop column tarifa_mensual;

-- users nunca tuvo salario_mensual, pero cada usuario existente necesita su
-- fila compañera para que el resto del código pueda asumir la relación 1:1
-- sin null-checks especiales.
insert into public.user_salaries (user_id)
  select id from public.users
  on conflict (user_id) do nothing;

-- Auto-provisiona la fila compañera en cada alta nueva.
create or replace function public.handle_new_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_rates (client_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_client_created after insert on public.clients
  for each row execute function public.handle_new_client();

create or replace function public.handle_new_user_salary_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_salaries (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_user_created_salary_row after insert on public.users
  for each row execute function public.handle_new_user_salary_row();
