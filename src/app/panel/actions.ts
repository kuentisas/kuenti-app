"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function startTimer(clientId: string, processId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("start_timer", {
    p_client_id: clientId,
    p_process_id: processId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/panel");
  return { error: null };
}

export async function stopTimer() {
  const supabase = createClient();
  const { error } = await supabase.rpc("stop_timer");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/panel");
  return { error: null };
}
