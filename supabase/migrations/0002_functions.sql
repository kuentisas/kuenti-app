-- Funciones auxiliares para RLS y para el alta automática de perfiles.

-- security definer: evita recursión de RLS al consultar public.users desde
-- una policy que se aplica sobre la propia tabla public.users.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.deleted_at is null
  );
$$;

create or replace function public.is_assigned_to_client(client_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.client_assignments ca
    where ca.client_id = client_uuid
      and ca.user_id = auth.uid()
  );
$$;

-- Alta automática del perfil al crear (o invitar) un usuario en auth.users.
-- Lee nombre/rol de raw_user_meta_data, seteados por el admin al invitar.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, nombre, role, activo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'colaboradora'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
