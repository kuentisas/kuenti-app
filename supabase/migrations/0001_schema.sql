-- Kuenti Time Tracking — esquema base
-- Requiere extensión pgcrypto para gen_random_uuid() (habilitada por defecto en Supabase)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- users: perfil de aplicación, 1:1 con auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null,
  role text not null default 'colaboradora' check (role in ('admin', 'colaboradora')),
  activo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'Perfil de aplicación. deleted_at marca usuarios eliminados cuyo historial de horas se conserva.';

-- ---------------------------------------------------------------------------
-- clients: clientes de la firma contable
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  tarifa_mensual numeric(14, 2) not null default 0 check (tarifa_mensual >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- processes: procesos/servicios por cliente (ej. nómina, contabilidad, IVA)
-- ---------------------------------------------------------------------------
create table public.processes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index processes_client_id_idx on public.processes (client_id);

-- ---------------------------------------------------------------------------
-- client_assignments: asignación muchos-a-muchos cliente <-> colaboradora
-- ---------------------------------------------------------------------------
create table public.client_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

create index client_assignments_user_id_idx on public.client_assignments (user_id);
create index client_assignments_client_id_idx on public.client_assignments (client_id);

-- ---------------------------------------------------------------------------
-- time_entries: registros de tiempo. user_id es RESTRICT a propósito: impide
-- borrar un usuario que ya tenga historial, forzando el flujo de desactivación
-- en vez de una eliminación destructiva (ver server actions de usuarios).
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  process_id uuid not null references public.processes (id) on delete restrict,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  duration_seconds integer generated always as (
    case
      when end_time is null then null
      else greatest(0, extract(epoch from (end_time - start_time))::integer)
    end
  ) stored,
  created_at timestamptz not null default now(),
  constraint time_entries_end_after_start check (end_time is null or end_time >= start_time)
);

create index time_entries_user_id_idx on public.time_entries (user_id);
create index time_entries_client_id_idx on public.time_entries (client_id);
create index time_entries_process_id_idx on public.time_entries (process_id);
create index time_entries_start_time_idx on public.time_entries (start_time);

-- Solo un timer activo (end_time is null) por colaboradora a la vez.
create unique index time_entries_one_active_per_user_idx
  on public.time_entries (user_id)
  where end_time is null;

-- ---------------------------------------------------------------------------
-- app_settings: fila única con parámetros globales (costo hora promedio)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  costo_hora_promedio numeric(14, 2) not null default 25000 check (costo_hora_promedio >= 0),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- updated_at trigger genérico
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.processes
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
