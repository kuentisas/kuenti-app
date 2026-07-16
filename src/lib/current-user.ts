import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/database";

export interface CurrentUserProfile {
  id: string;
  nombre: string;
  role: Role;
}

// cache() de React deduplica por request: layout y page pueden llamar
// esto por separado sin pagar dos round-trips a la base de datos.
export const getCurrentUserProfile = cache(async (): Promise<CurrentUserProfile | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, nombre, role")
    .eq("id", user.id)
    .single();

  return data;
});
