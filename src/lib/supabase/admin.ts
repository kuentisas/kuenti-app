import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Cliente con la service role key: bypassa RLS. Solo para server actions que
 * necesiten invitar/eliminar usuarios de auth.users. Nunca importar desde
 * código de cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
