-- Hallazgo de auditoría: una colaboradora podía crear (vía API directa,
-- sin pasar por el formulario que siempre manda el mes actual) una
-- actividad eventual con mes_aplicable de un mes ya vencido o futuro. No
-- era explotable para registrar horas (start_activity ya lo bloqueaba),
-- pero ensuciaba el log de "Actividades eventuales agregadas" del admin
-- con fechas inconsistentes. Mismo criterio que ya se usa acá para
-- estado_aprobacion y sugerida_por: se fuerza el valor server-side en vez
-- de solo validar y rechazar lo que mande el cliente.
create or replace function public.set_activity_approval_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin_or_supervisor() then
    new.estado_aprobacion := 'aprobada';
    new.sugerida_por := auth.uid();
    if new.tipo <> 'eventual' then
      raise exception 'Las colaboradoras solo pueden sugerir actividades eventuales'
        using errcode = '42501';
    end if;
    new.mes_aplicable := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  end if;
  return new;
end;
$$;
