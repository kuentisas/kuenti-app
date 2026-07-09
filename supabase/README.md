# Migraciones Kuenti

Aplica las migraciones en orden con el CLI de Supabase (`supabase db push`) o
pegando cada archivo en el SQL Editor del dashboard, en este orden:

1. `0001_schema.sql`
2. `0002_functions.sql`
3. `0003_rls.sql`
4. `0004_realtime.sql`

## Crear el primer administrador

1. En el dashboard de Supabase → Authentication → Users → **Invite user**,
   invita al correo del primer admin. Esto dispara el trigger
   `handle_new_auth_user`, que crea su fila en `public.users` con
   `role = 'colaboradora'` por defecto.
2. Sube su rol a admin:

   ```sql
   update public.users set role = 'admin' where email = 'admin@kuenti.co';
   ```

Desde ese momento, ese usuario puede invitar y administrar al resto del
equipo desde la app (Gestión de usuarios), sin volver a tocar SQL.
