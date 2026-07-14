-- Evita actividades duplicadas (mismo nombre, ignorando mayúsculas/minúsculas
-- y espacios en los extremos) para un mismo cliente. Cierra el hueco que
-- dejaba el alta masiva por comas: si se repite un nombre, el insert falla
-- con un error de restricción única en vez de crear una fila duplicada.
create unique index activities_client_nombre_unique_idx
  on public.activities (client_id, lower(trim(nombre)));
