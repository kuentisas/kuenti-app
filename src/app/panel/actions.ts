"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { bogotaDatetimeLocalToISOString } from "@/lib/dates";

export async function startActivity(clientId: string, activityId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("start_activity", {
    p_client_id: clientId,
    p_activity_id: activityId,
  });

  if (error) {
    return { error: error.message, autoStopped: null };
  }

  revalidatePath("/panel");
  return { error: null, autoStopped: data?.auto_stopped ?? null };
}

export async function stopActivity() {
  const supabase = createClient();
  const { error } = await supabase.rpc("stop_activity", {});

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/panel");
  return { error: null };
}

const suggestActivitySchema = z.object({
  clientId: z.string().uuid(),
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  motivo: z.string().trim().min(1, "El motivo es requerido"),
});

export async function suggestActivity(clientId: string, nombre: string, motivo: string) {
  const parsed = suggestActivitySchema.safeParse({ clientId, nombre, motivo });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const now = new Date();
  const mesAplicable = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const supabase = createClient();
  // estado_aprobacion y sugerida_por los fuerza el trigger
  // set_activity_approval_defaults en el servidor (Fase 1) — no hace falta
  // (ni conviene) mandarlos desde acá.
  const { error } = await supabase.from("activities").insert({
    client_id: parsed.data.clientId,
    nombre: parsed.data.nombre,
    motivo: parsed.data.motivo,
    tipo: "eventual",
    mes_aplicable: mesAplicable,
  });

  if (error) return { error: error.message };

  revalidatePath("/panel");
  return { error: null };
}

const requestCorrectionSchema = z.object({
  timeEntryId: z.string().uuid(),
  nuevaHoraFin: z.string().min(1, "La hora es requerida"),
  motivo: z.string().trim().min(1, "El motivo es requerido"),
});

export async function requestCorrection(
  timeEntryId: string,
  nuevaHoraFin: string,
  motivo: string
) {
  const parsed = requestCorrectionSchema.safeParse({ timeEntryId, nuevaHoraFin, motivo });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("activity_corrections").insert({
    time_entry_id: parsed.data.timeEntryId,
    user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
    motivo: parsed.data.motivo,
    nueva_hora_fin_sugerida: bogotaDatetimeLocalToISOString(parsed.data.nuevaHoraFin),
  });

  if (error) return { error: error.message };

  revalidatePath("/panel");
  return { error: null };
}

const resolveStaleTimerSchema = z.object({
  choice: z.enum(["seguido", "ajustado"]),
  actualEndTime: z.string().optional(),
  nota: z.string().trim().optional(),
});

export async function resolveStaleTimer(
  choice: "seguido" | "ajustado",
  actualEndTime?: string,
  nota?: string
) {
  const parsed = resolveStaleTimerSchema.safeParse({ choice, actualEndTime, nota });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_stale_timer", {
    p_choice: parsed.data.choice,
    p_actual_end_time: parsed.data.actualEndTime
      ? bogotaDatetimeLocalToISOString(parsed.data.actualEndTime)
      : null,
    p_nota_ajuste: parsed.data.nota ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/panel");
  return { error: null };
}
