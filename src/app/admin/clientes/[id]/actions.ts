"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const activitySchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
});

// Acepta varios nombres a la vez (separados por coma en la UI) para no
// obligar a agregar las actividades de un cliente una por una. Un solo
// insert con varias filas: o se crean todas, o ninguna.
export async function createProcess(clientId: string, nombres: string[]) {
  const cleaned = nombres.map((n) => n.trim()).filter((n) => n.length > 0);
  if (cleaned.length === 0) {
    return { error: "El nombre es requerido" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("activities")
    .insert(cleaned.map((nombre) => ({ client_id: clientId, nombre })));

  if (error) {
    // 23505: activities_client_nombre_unique_idx (migración 0018) — mismo
    // nombre ya existe para este cliente (sin distinguir mayúsculas/espacios).
    if (error.code === "23505") {
      return { error: "Ya existe una actividad con ese nombre para este cliente." };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/clientes/${clientId}`);
  return { error: null };
}

export async function updateProcess(
  activityId: string,
  clientId: string,
  formData: FormData
) {
  const parsed = activitySchema.safeParse({ nombre: formData.get("nombre") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("activities")
    .update({ nombre: parsed.data.nombre })
    .eq("id", activityId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una actividad con ese nombre para este cliente." };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/clientes/${clientId}`);
  return { error: null };
}

// Si la actividad nunca registró horas, se elimina físicamente. Si ya tiene
// time_entries asociadas, la FK (on delete restrict) lo impide a propósito
// para no perder historial — en ese caso se desactiva en su lugar, mismo
// patrón que el soft-delete de usuarios.
export async function deleteProcess(activityId: string, clientId: string) {
  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (!deleteError) {
    revalidatePath(`/admin/clientes/${clientId}`);
    return { error: null, mode: "hard" as const };
  }

  if (deleteError.code !== "23503") {
    return { error: deleteError.message };
  }

  const { error: deactivateError } = await supabase
    .from("activities")
    .update({ activo: false })
    .eq("id", activityId);

  if (deactivateError) return { error: deactivateError.message };

  revalidatePath(`/admin/clientes/${clientId}`);
  return { error: null, mode: "soft" as const };
}

export async function toggleProcessActivo(
  activityId: string,
  clientId: string,
  activo: boolean
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("activities")
    .update({ activo })
    .eq("id", activityId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/clientes/${clientId}`);
  return { error: null };
}

export async function setClientAssignments(clientId: string, userIds: string[]) {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("client_assignments")
    .delete()
    .eq("client_id", clientId);

  if (deleteError) return { error: deleteError.message };

  if (userIds.length > 0) {
    const { error: insertError } = await supabase
      .from("client_assignments")
      .insert(userIds.map((userId) => ({ client_id: clientId, user_id: userId })));

    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/admin/clientes/${clientId}`);
  revalidatePath("/admin/usuarios");
  return { error: null };
}
