"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";

// Exclusivo admin: la policy RLS de client_assignments permite
// insert/update/delete también a supervisor (is_admin_or_supervisor(),
// migración 0021), así que sin este guard explícito un supervisor podría
// ejecutar esta acción igual — mismo criterio que deleteUser en
// usuarios/actions.ts, la única otra acción "exclusiva admin" del proyecto.
//
// Solo toca client_assignments (join table pura: sin FK ni trigger hacia
// time_entries) — el historial de horas ya registrado nunca se ve afectado,
// igual que en reassignClients.
export async function unassignAllClients() {
  const guard = await requireRole(["admin"]);
  // Nota: se reconstruye el objeto en vez de `return guard` — TypeScript no
  // narrowea bien en el llamador (asignaciones-view.tsx) el acceso a
  // `.count` si se retorna la variable ya angostada en vez de un literal
  // fresco (confirmado con un repro aislado).
  if ("error" in guard) return { error: guard.error };

  const supabase = createClient();

  // .not("id", "is", null) en vez de un delete sin filtro: PostgREST exige
  // al menos un filtro en un delete, y como id nunca es null esto borra
  // todas las filas por igual.
  const { data: deleted, error } = await supabase
    .from("client_assignments")
    .delete()
    .not("id", "is", null)
    .select("id");

  if (error) return { error: error.message };

  revalidatePath("/admin/asignaciones");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/usuarios");

  return { error: null, count: deleted?.length ?? 0 };
}
