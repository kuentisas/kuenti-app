"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { BOGOTA_TZ, bogotaDatetimeLocalToISOString, bogotaMonthKey } from "@/lib/dates";

function formatHoraBogota(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: BOGOTA_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  const mesAplicable = `${bogotaMonthKey()}-01`;

  const supabase = createClient();
  // estado_aprobacion y sugerida_por los fuerza el trigger
  // set_activity_approval_defaults en el servidor — no hace falta (ni
  // conviene) mandarlos desde acá. Desde el cambio de "sin aprobación",
  // el trigger deja la actividad en 'aprobada' de una.
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
  nuevaHoraInicio: z.string().min(1).nullable(),
});

export async function requestCorrection(
  timeEntryId: string,
  nuevaHoraFin: string,
  motivo: string,
  nuevaHoraInicio: string | null = null
) {
  const parsed = requestCorrectionSchema.safeParse({
    timeEntryId,
    nuevaHoraFin,
    motivo,
    nuevaHoraInicio,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const nuevaHoraFinISO = bogotaDatetimeLocalToISOString(parsed.data.nuevaHoraFin);
  const nuevaHoraInicioISO = parsed.data.nuevaHoraInicio
    ? bogotaDatetimeLocalToISOString(parsed.data.nuevaHoraInicio)
    : null;
  const { error } = await supabase.from("activity_corrections").insert({
    time_entry_id: parsed.data.timeEntryId,
    user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
    motivo: parsed.data.motivo,
    nueva_hora_fin_sugerida: nuevaHoraFinISO,
    nueva_hora_inicio_sugerida: nuevaHoraInicioISO,
  });

  if (error) {
    // El mensaje crudo de RLS ("new row violates row-level security
    // policy...") no le dice nada a la colaboradora. La policy de INSERT
    // (0027) exige coalesce(nueva_hora_inicio_sugerida, start_time) <=
    // nueva_hora_fin_sugerida <= now() — se traduce a un mensaje
    // accionable buscando el registro original para saber cuál condición
    // falló.
    if (error.code === "42501") {
      const { data: entry } = await supabase
        .from("time_entries")
        .select("start_time")
        .eq("id", parsed.data.timeEntryId)
        .maybeSingle();

      const horaInicioEfectiva = nuevaHoraInicioISO ?? entry?.start_time ?? null;

      if (horaInicioEfectiva && nuevaHoraFinISO < horaInicioEfectiva) {
        return {
          error: nuevaHoraInicioISO
            ? "La hora de fin no puede ser anterior a la hora de inicio que estás corrigiendo."
            : `La hora de fin no puede ser anterior a la hora de inicio del registro (${formatHoraBogota(horaInicioEfectiva)}). Si también necesitas corregir la hora de inicio, marca la casilla correspondiente.`,
        };
      }
      if (nuevaHoraFinISO > new Date().toISOString()) {
        return { error: "La hora de fin no puede ser en el futuro." };
      }
      if (nuevaHoraInicioISO && nuevaHoraInicioISO > new Date().toISOString()) {
        return { error: "La hora de inicio no puede ser en el futuro." };
      }
      return { error: "No se pudo enviar la corrección para este registro." };
    }
    return { error: error.message };
  }

  revalidatePath("/panel");
  return { error: null };
}

export async function markCorrectionsSeen() {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_corrections_seen");

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
