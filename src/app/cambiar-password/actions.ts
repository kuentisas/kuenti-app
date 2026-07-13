"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const changePasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmacion: z.string(),
  })
  .refine((data) => data.password === data.confirmacion, {
    message: "Las contraseñas no coinciden",
    path: ["confirmacion"],
  });

export async function changePassword(password: string, confirmacion: string) {
  const parsed = changePasswordSchema.safeParse({ password, confirmacion });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const { error: updateAuthError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateAuthError) return { error: updateAuthError.message };

  // La policy de UPDATE en users es admin-only (using is_admin()), sin
  // excepción para que una fila se actualice a sí misma — con el cliente
  // normal esto afecta 0 filas en silencio (RLS no lanza error, solo no
  // matchea nada), así que el flag nunca se apagaba y el middleware volvía
  // a mandar para acá en loop. Se usa el cliente admin para este único
  // campo de sistema, ya validado el usuario real arriba.
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.",
    };
  }

  const { data: updated, error: updateProfileError } = await adminClient
    .from("users")
    .update({ debe_cambiar_password: false })
    .eq("id", user.id)
    .select()
    .single();

  if (updateProfileError) return { error: updateProfileError.message };
  if (!updated) return { error: "No se pudo actualizar tu perfil. Intenta de nuevo." };

  return { error: null };
}
