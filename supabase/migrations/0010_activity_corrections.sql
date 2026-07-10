-- Solicitudes de corrección de registros de tiempo por parte de
-- colaboradoras. No hay policy de UPDATE/DELETE en esta tabla: la única
-- forma de cambiar estado es a través de approve_correction/reject_correction
-- (0012), security definer con is_admin() interno. Esto es más fuerte que
-- "RLS admin-only en UPDATE": ni siquiera un admin puede hacer un UPDATE
-- directo que solo toque esta tabla sin también aplicar el cambio a
-- time_entries en la misma transacción.

create table public.activity_corrections (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  motivo text not null,
  nueva_hora_fin_sugerida timestamptz not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  revisado_por uuid references public.users (id) on delete set null,
  nota_revision text,
  fecha_revision timestamptz,
  created_at timestamptz not null default now()
);

create index activity_corrections_time_entry_id_idx on public.activity_corrections (time_entry_id);
create index activity_corrections_user_id_idx on public.activity_corrections (user_id);
create index activity_corrections_estado_idx on public.activity_corrections (estado) where estado = 'pendiente';
