-- set_activity_approval_defaults (0007) tiene su propio chequeo interno
-- de is_admin(), igual que approve_correction/reject_correction —
-- independiente de las policies de RLS ya ampliadas en 0021. Sin este
-- fix, un supervisor creando una actividad recurrente normal caía en la
-- rama de "colaboradora sugiriendo" y era rechazado.
create or replace function public.set_activity_approval_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin_or_supervisor() then
    new.estado_aprobacion := 'pendiente';
    new.sugerida_por := auth.uid();
    if new.tipo <> 'eventual' then
      raise exception 'Las colaboradoras solo pueden sugerir actividades eventuales'
        using errcode = '42501';
    end if;
    if new.mes_aplicable is null then
      raise exception 'mes_aplicable es obligatorio para actividades eventuales sugeridas'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
