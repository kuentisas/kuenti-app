"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";

const clientSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  nit: z.string().trim().optional(),
  tarifa_mensual: z.coerce.number().min(0, "La tarifa debe ser positiva").optional(),
});

export async function createClientRecord(formData: FormData) {
  const tarifaRaw = formData.get("tarifa_mensual");
  const parsed = clientSchema.safeParse({
    nombre: formData.get("nombre"),
    nit: formData.get("nit") || undefined,
    tarifa_mensual: tarifaRaw ? tarifaRaw : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .insert({ nombre: parsed.data.nombre, nit: parsed.data.nit || null })
    .select()
    .single();

  if (error) return { error: error.message };

  // set_client_tarifa decide sola la vigencia: como es la primera fila de
  // historial de este cliente, aplica desde el mes actual (no es un
  // "cambio" a un valor existente).
  if (parsed.data.tarifa_mensual !== undefined) {
    const { error: rateError } = await supabase.rpc("set_client_tarifa", {
      p_client_id: client.id,
      p_tarifa_mensual: parsed.data.tarifa_mensual,
    });
    if (rateError) return { error: rateError.message };
  }

  revalidatePath("/admin/clientes");
  return { error: null };
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  const tarifaRaw = formData.get("tarifa_mensual");
  const parsed = clientSchema.safeParse({
    nombre: formData.get("nombre"),
    nit: formData.get("nit") || undefined,
    tarifa_mensual: tarifaRaw ? tarifaRaw : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .update({ nombre: parsed.data.nombre, nit: parsed.data.nit || null })
    .eq("id", clientId);

  if (error) return { error: error.message };

  // El campo tarifa_mensual no existe en el DOM del formulario para un
  // supervisor (ver ClientFormDialog) — formData.has() distingue eso de
  // "el admin la borró" (el input sigue presente con valor vacío). Sin
  // este chequeo, un supervisor editando nombre/NIT dispararía un
  // set_client_tarifa(null) sin querer (que además rechazaría la función,
  // pero mejor ni intentarlo).
  //
  // Cambia siempre "hacia adelante" (mes actual si es la primera vez,
  // mes siguiente si ya había una tarifa) — set_client_tarifa decide la
  // vigencia, nunca este código. Para corregir un mes ya pasado existe
  // correctClientTarifaHistorico, una acción separada y explícita.
  if (formData.has("tarifa_mensual") && parsed.data.tarifa_mensual !== undefined) {
    const { error: rateError } = await supabase.rpc("set_client_tarifa", {
      p_client_id: clientId,
      p_tarifa_mensual: parsed.data.tarifa_mensual,
    });
    if (rateError) return { error: rateError.message };
  }

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clientId}`);
  revalidatePath("/admin/rentabilidad");
  return { error: null };
}

const correctionSchema = z.object({
  clientId: z.string().uuid(),
  tarifa: z.coerce.number().min(0, "La tarifa debe ser positiva"),
  mesKey: z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido"),
});

// Corrección retroactiva — solo admin (requireRole acá, además del
// chequeo interno de la función; ambos deben coincidir con is_admin()).
// Acción separada y explícita a propósito: nunca es el comportamiento
// por defecto de updateClientRecord, para no reescribir historial sin
// querer.
export async function correctClientTarifaHistorico(
  clientId: string,
  tarifa: number,
  mesKey: string
) {
  const guard = await requireRole(["admin"]);
  if ("error" in guard) return guard;

  const parsed = correctionSchema.safeParse({ clientId, tarifa, mesKey });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("correct_client_tarifa_historico", {
    p_client_id: parsed.data.clientId,
    p_tarifa_mensual: parsed.data.tarifa,
    p_vigente_desde: `${parsed.data.mesKey}-01`,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/clientes/${clientId}`);
  revalidatePath("/admin/rentabilidad");
  return { error: null };
}

export async function toggleClientActivo(clientId: string, activo: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .update({ activo })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clientId}`);
  return { error: null };
}
