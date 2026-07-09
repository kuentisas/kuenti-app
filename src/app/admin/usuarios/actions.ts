"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const inviteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  email: z.string().trim().email("Correo inválido"),
  role: z.enum(["admin", "colaboradora"]),
});

export async function inviteUser(formData: FormData) {
  const parsed = inviteSchema.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      error:
        "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para poder invitar usuarios.",
    };
  }

  const { error } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { nombre: parsed.data.nombre, role: parsed.data.role },
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function deactivateUser(userId: string) {
  const supabase = createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser?.id === userId) {
    return { error: "No puedes desactivar tu propia cuenta." };
  }

  const { error } = await supabase.from("users").update({ activo: false }).eq("id", userId);
  if (error) return { error: error.message };

  try {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  } catch {
    // Sin service role key: el flag activo=false ya bloquea el acceso vía middleware.
  }

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function reactivateUser(userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ activo: true, deleted_at: null })
    .eq("id", userId);

  if (error) return { error: error.message };

  try {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
  } catch {
    // Ver comentario en deactivateUser.
  }

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function deleteUser(userId: string) {
  const supabase = createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser?.id === userId) {
    return { error: "No puedes eliminar tu propia cuenta." };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para poder eliminar usuarios.",
    };
  }

  const { error: hardDeleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (!hardDeleteError) {
    revalidatePath("/admin/usuarios");
    return { error: null, mode: "hard" as const };
  }

  // El borrado real falló porque el usuario tiene time_entries asociadas
  // (time_entries.user_id es ON DELETE RESTRICT). Se conserva su historial:
  // se desactiva, se marca como eliminada y se bloquea su acceso a auth.
  const { error: softDeleteError } = await supabase
    .from("users")
    .update({ activo: false, deleted_at: new Date().toISOString() })
    .eq("id", userId);

  if (softDeleteError) return { error: softDeleteError.message };

  await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });

  revalidatePath("/admin/usuarios");
  return { error: null, mode: "soft" as const };
}

export async function reassignAllClients(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    return { error: "Selecciona un miembro del equipo distinto como destino." };
  }

  const supabase = createClient();

  const { data: fromAssignments, error: fetchError } = await supabase
    .from("client_assignments")
    .select("client_id")
    .eq("user_id", fromUserId);

  if (fetchError) return { error: fetchError.message };

  const clientIds = (fromAssignments ?? []).map((a) => a.client_id);

  const { error: deleteError } = await supabase
    .from("client_assignments")
    .delete()
    .eq("user_id", fromUserId);

  if (deleteError) return { error: deleteError.message };

  if (clientIds.length > 0) {
    const rows = clientIds.map((client_id) => ({ client_id, user_id: toUserId }));
    const { error: insertError } = await supabase
      .from("client_assignments")
      .upsert(rows, { onConflict: "client_id,user_id", ignoreDuplicates: true });

    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/clientes");
  return { error: null, count: clientIds.length };
}
