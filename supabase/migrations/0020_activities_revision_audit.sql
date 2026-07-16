-- Mismo patrón de auditoría que ya existe en activity_corrections: hoy
-- aprobar/rechazar una actividad sugerida solo cambia estado_aprobacion,
-- sin dejar rastro de quién decidió ni cuándo.
alter table public.activities
  add column revisado_por uuid references public.users (id) on delete set null,
  add column fecha_revision timestamptz,
  add column nota_revision text;
