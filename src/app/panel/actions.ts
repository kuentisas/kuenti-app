"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
