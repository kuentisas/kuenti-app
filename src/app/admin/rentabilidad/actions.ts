"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function updateCostoHoraPromedio(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return { error: "El valor debe ser un número positivo." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ costo_hora_promedio: value })
    .eq("id", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/rentabilidad");
  return { error: null };
}
