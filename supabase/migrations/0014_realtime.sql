-- Habilita Realtime en activities (badge en vivo de pendientes de
-- aprobación) y activity_corrections (cola de correcciones pendientes del
-- admin). time_entries ya está habilitado desde 0004.

alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.activity_corrections;
