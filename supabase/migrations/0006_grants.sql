-- Los roles de PostgREST (authenticated, service_role) necesitan el GRANT de
-- tabla de base independientemente de RLS: Postgres evalúa privilegios antes
-- que las policies, así que sin esto toda operación falla con "permission
-- denied" aunque la policy la permitiría. anon queda fuera a propósito: toda
-- la app requiere sesión, no hay rutas públicas.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on public.users to authenticated, service_role;
grant select, insert, update, delete on public.clients to authenticated, service_role;
grant select, insert, update, delete on public.processes to authenticated, service_role;
grant select, insert, update, delete on public.client_assignments to authenticated, service_role;
grant select, insert, update, delete on public.time_entries to authenticated, service_role;
grant select, insert, update, delete on public.app_settings to authenticated, service_role;
