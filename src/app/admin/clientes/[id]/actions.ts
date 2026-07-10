"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const activitySchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
});

export async function createProcess(clientId: string, formData: FormData) {
  const parsed = activitySchema.safeParse({ nombre: formData.get("nombre") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("activities")
    .insert({ client_id: clientId, nombre: parsed.data.nombre });

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

  revalidatePath(`/admin/clientes/${clientId}`);
  return { error: null };
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
