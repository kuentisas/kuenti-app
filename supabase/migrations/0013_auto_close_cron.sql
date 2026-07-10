-- Auto-cierre de seguridad: timers activos por más de 12h se cierran solos
-- cada 15 minutos, vía pg_cron (corre dentro de la base, no depende de que
-- la app esté desplegada).

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'auto-close-stale-timers';

select cron.schedule(
  'auto-close-stale-timers',
  '*/15 * * * *',
  $$select public.auto_close_stale_timers();$$
);
