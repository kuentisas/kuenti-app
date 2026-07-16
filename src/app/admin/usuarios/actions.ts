"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/require-role";

const createMemberSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  email: z.string().trim().email("Correo inválido"),
  role: z.enum(["admin", "supervisor", "colaboradora"]),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  debeCambiarPassword: z.boolean(),
});

// Opción B: el admin asigna la contraseña directamente (en vez de
// invitación por correo) — no depende de que el correo llegue ni de la
// configuración de Site URL/Redirect URLs de Supabase Auth. Con
// debeCambiarPassword=true, el middleware obliga a cambiarla en el primer
// inicio de sesión.
//
// Usa el cliente admin (service role), que bypasea RLS por completo —
// por eso la verificación de rol de quien llama vive acá adentro, no
// solo en que /admin/usuarios esté bloqueado por el middleware. Un
// supervisor puede crear miembros, pero únicamente con role=colaboradora
// (nunca otro supervisor ni admin), sin importar qué haya mandado el
// formulario — se fuerza server-side, la UI solo evita mostrarlo.
export async function createTeamMember(formData: FormData) {
  const guard = await requireRole(["admin", "supervisor"]);
  if ("error" in guard) return guard;

  const parsed = createMemberSchema.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
    debeCambiarPassword: formData.get("debeCambiarPassword") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  if (guard.profile.role === "supervisor" && parsed.data.role !== "colaboradora") {
    return { error: "Un supervisor solo puede crear miembros del equipo." };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      error:
        "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para poder crear usuarios.",
    };
  }

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { nombre: parsed.data.nombre, role: parsed.data.role },
  });

  if (createErr) return { error: createErr.message };

  // handle_new_auth_user ya creó la fila en public.users con nombre/role
  // desde los metadatos (mismo trigger de siempre); acá solo completamos
  // el flag de cambio de contraseña obligatorio.
  const supabase = createClient();
  const { error: updateErr } = await supabase
    .from("users")
    .update({ debe_cambiar_password: parsed.data.debeCambiarPassword })
    .eq("id", created.user.id);

  if (updateErr) return { error: updateErr.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  debeCambiarPassword: z.boolean(),
});

// Para una cuenta que ya existe (contraseña olvidada, invitación vieja
// rota, etc.) — a diferencia de createTeamMember, no crea un usuario
// nuevo. Usa el cliente admin para ambas escrituras: updateUserById
// (auth) requiere service_role de por sí, y se reutiliza el mismo
// cliente para el flag de perfil por consistencia con ese patrón.
export async function resetUserPassword(
  userId: string,
  password: string,
  debeCambiarPassword: boolean
) {
  const guard = await requireRole(["admin", "supervisor"]);
  if ("error" in guard) return guard;

  const parsed = resetPasswordSchema.safeParse({ userId, password, debeCambiarPassword });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      error:
        "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para poder restablecer contraseñas.",
    };
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(parsed.data.userId, {
    password: parsed.data.password,
  });

  if (authError) return { error: authError.message };

  const { error: profileError } = await adminClient
    .from("users")
    .update({ debe_cambiar_password: parsed.data.debeCambiarPassword })
    .eq("id", parsed.data.userId);

  if (profileError) return { error: profileError.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function deactivateUser(userId: string) {
  const guard = await requireRole(["admin", "supervisor"]);
  if ("error" in guard) return guard;

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
  const guard = await requireRole(["admin", "supervisor"]);
  if ("error" in guard) return guard;

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

// Exclusivo admin — a diferencia del resto de las acciones de esta
// tabla, un supervisor no puede eliminar usuarios.
export async function deleteUser(userId: string) {
  const guard = await requireRole(["admin"]);
  if ("error" in guard) return guard;

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

// clientIds: subconjunto elegido en el diálogo (puede ser todos o solo
// algunos). Solo se toca client_assignments — nunca time_entries, así que
// el historial de horas ya registrado se queda con su autor original,
// pase lo que pase con la asignación futura.
export async function reassignClients(fromUserId: string, toUserId: string, clientIds: string[]) {
  if (fromUserId === toUserId) {
    return { error: "Selecciona un miembro del equipo distinto como destino." };
  }
  if (clientIds.length === 0) {
    return { error: "Selecciona al menos un cliente para reasignar." };
  }

  const supabase = createClient();

  // Se reasigna solo lo que sigue realmente asignado a fromUserId hoy —
  // evita reasignar de más si el estado en pantalla quedó desfasado.
  const { data: fromAssignments, error: fetchError } = await supabase
    .from("client_assignments")
    .select("client_id")
    .eq("user_id", fromUserId)
    .in("client_id", clientIds);

  if (fetchError) return { error: fetchError.message };

  const actualClientIds = (fromAssignments ?? []).map((a) => a.client_id);

  if (actualClientIds.length === 0) {
    return { error: "Ninguno de los clientes seleccionados sigue asignado a este miembro." };
  }

  const { error: deleteError } = await supabase
    .from("client_assignments")
    .delete()
    .eq("user_id", fromUserId)
    .in("client_id", actualClientIds);

  if (deleteError) return { error: deleteError.message };

  const rows = actualClientIds.map((client_id) => ({ client_id, user_id: toUserId }));
  const { error: insertError } = await supabase
    .from("client_assignments")
    .upsert(rows, { onConflict: "client_id,user_id", ignoreDuplicates: true });

  if (insertError) return { error: insertError.message };

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/clientes");
  return { error: null, count: actualClientIds.length };
}

const salarySchema = z.object({
  userId: z.string().uuid(),
  salario: z.coerce.number().min(0, "El salario debe ser positivo"),
});

export async function updateUserSalary(userId: string, salario: number) {
  const parsed = salarySchema.safeParse({ userId, salario });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  // RLS: user_salaries es admin-only sin excepciones (Fase 1), así que este
  // update ya está protegido a nivel de motor, no solo por estar en una
  // página de /admin.
  const { error } = await supabase
    .from("user_salaries")
    .update({ salario_mensual: parsed.data.salario })
    .eq("user_id", parsed.data.userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/rentabilidad");
  return { error: null };
}
