-- Habilita Realtime en time_entries para el panel de timers activos del admin.
alter publication supabase_realtime add table public.time_entries;
