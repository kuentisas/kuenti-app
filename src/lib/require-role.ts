import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/current-user";
import type { Role } from "@/types/database";

// Para server actions que escriben con el cliente admin (service role) y
// por lo tanto NO pasan por RLS — ahí la verificación de rol tiene que
// vivir en el propio código, no solo en que la ruta esté bloqueada por
// el middleware. Uso: `const guard = await requireRole(["admin","supervisor"]);
// if ("error" in guard) return guard;` al principio de la action.
export async function requireRole(
  allowed: Role[]
): Promise<{ profile: CurrentUserProfile } | { error: string }> {
  const profile = await getCurrentUserProfile();

  if (!profile || !allowed.includes(profile.role)) {
    return { error: "No tienes permiso para realizar esta acción." };
  }

  return { profile };
}
