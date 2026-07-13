-- Soporta el flujo de alta con contraseña asignada por el admin (opción B,
-- en vez de invitación por correo): si queda en true, el middleware obliga
-- a la persona a cambiar su contraseña antes de usar el resto de la app.
alter table public.users add column debe_cambiar_password boolean not null default false;
