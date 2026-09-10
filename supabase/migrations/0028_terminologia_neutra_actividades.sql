-- Barrido de terminología: el mensaje de excepción decía "Las
-- colaboradoras..." (femenino fijo), pero no todo el equipo son mujeres.
-- Mismo cambio de fondo que ya se aplicó en el resto de la UI (badges de
-- estado, vista de Asignaciones, etc.) — acá porque el texto crudo de
-- Postgres puede llegar a mostrarse tal cual en un toast (mismo patrón que
-- otros `result.error` de la app). Sin cambios de lógica: misma función,
-- solo el literal del mensaje.
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
      raise exception 'Un miembro del equipo solo puede sugerir actividades eventuales'
        using errcode = '42501';
    end if;
    new.mes_aplicable := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  end if;
  return new;
end;
$$;
