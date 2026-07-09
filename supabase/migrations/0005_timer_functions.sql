-- Funciones atómicas para el timer de colaboradoras. security invoker: se
-- ejecutan con los permisos y RLS del usuario que llama, no hay bypass.

create or replace function public.start_timer(p_client_id uuid, p_process_id uuid)
returns public.time_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry public.time_entries;
begin
  -- Detiene cualquier timer activo del usuario antes de abrir uno nuevo.
  update public.time_entries
    set end_time = now()
    where user_id = auth.uid() and end_time is null;

  insert into public.time_entries (user_id, client_id, process_id, start_time)
  values (auth.uid(), p_client_id, p_process_id, now())
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.stop_timer()
returns public.time_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry public.time_entries;
begin
  update public.time_entries
    set end_time = now()
    where user_id = auth.uid() and end_time is null
    returning * into v_entry;

  return v_entry;
end;
$$;

grant execute on function public.start_timer(uuid, uuid) to authenticated;
grant execute on function public.stop_timer() to authenticated;
