"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function approveActivity(activityId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("activities")
    .update({
      estado_aprobacion: "aprobada",
      revisado_por: user?.id ?? null,
      fecha_revision: new Date().toISOString(),
    })
    .eq("id", activityId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/aprobaciones");
  return { error: null };
}

export async function rejectActivity(activityId: string, reason?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("activities")
    .update({
      estado_aprobacion: "rechazada",
      revisado_por: user?.id ?? null,
      fecha_revision: new Date().toISOString(),
      nota_revision: reason ?? null,
    })
    .eq("id", activityId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/aprobaciones");
  return { error: null };
}

export async function approveCorrectionAction(correctionId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("approve_correction", {
    p_correction_id: correctionId,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/aprobaciones");
  return { error: null };
}

export async function rejectCorrectionAction(correctionId: string, reason?: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("reject_correction", {
    p_correction_id: correctionId,
    p_reason: reason ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/aprobaciones");
  return { error: null };
}
