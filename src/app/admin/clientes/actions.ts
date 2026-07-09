"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const clientSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  nit: z.string().trim().optional(),
  tarifa_mensual: z.coerce.number().min(0, "La tarifa debe ser positiva"),
});

export async function createClientRecord(formData: FormData) {
  const parsed = clientSchema.safeParse({
    nombre: formData.get("nombre"),
    nit: formData.get("nit") || undefined,
    tarifa_mensual: formData.get("tarifa_mensual"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("clients").insert({
    nombre: parsed.data.nombre,
    nit: parsed.data.nit || null,
    tarifa_mensual: parsed.data.tarifa_mensual,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/clientes");
  return { error: null };
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  const parsed = clientSchema.safeParse({
    nombre: formData.get("nombre"),
    nit: formData.get("nit") || undefined,
    tarifa_mensual: formData.get("tarifa_mensual"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      nombre: parsed.data.nombre,
      nit: parsed.data.nit || null,
      tarifa_mensual: parsed.data.tarifa_mensual,
    })
    .eq("id", clientId);

  if (error) return { error: error.message };

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
