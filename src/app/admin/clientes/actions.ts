"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

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

  // client_rates ya trae una fila auto-provisionada por el trigger
  // on_client_created (0008); si se cargó una tarifa, la actualizamos.
  if (parsed.data.tarifa_mensual !== undefined) {
    const { error: rateError } = await supabase
      .from("client_rates")
      .update({ tarifa_mensual: parsed.data.tarifa_mensual })
      .eq("client_id", client.id);
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

  const { error: rateError } = await supabase
    .from("client_rates")
    .update({ tarifa_mensual: parsed.data.tarifa_mensual ?? null })
    .eq("client_id", clientId);
  if (rateError) return { error: rateError.message };

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clientId}`);
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
