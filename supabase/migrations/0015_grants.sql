-- Grants para las tablas y funciones nuevas. Los grants de "processes"
-- (0006) ya aplican a "activities" tras el rename (están atados al OID de
-- la tabla, no al nombre), y lo mismo para time_entries: no se repiten aquí.

grant select, insert, update, delete on public.client_rates to authenticated, service_role;
grant select, insert, update, delete on public.user_salaries to authenticated, service_role;

-- activity_corrections: deliberadamente SIN update/delete para nadie (ni
-- authenticated ni service_role) — la única forma de cambiar su estado es
-- approve_correction/reject_correction (ver 0010 y 0012).
grant select, insert on public.activity_corrections to authenticated, service_role;

grant execute on function public.start_activity(uuid, uuid) to authenticated;
grant execute on function public.stop_activity(text) to authenticated;
grant execute on function public.resolve_stale_timer(text, timestamptz, text) to authenticated;
grant execute on function public.approve_correction(uuid) to authenticated;
grant execute on function public.reject_correction(uuid, text) to authenticated;

-- auto_close_stale_timers: nadie con rol authenticated ni service_role puede
-- invocarla directamente, solo el propio job de pg_cron (ver 0013).
revoke all on function public.auto_close_stale_timers() from public;
