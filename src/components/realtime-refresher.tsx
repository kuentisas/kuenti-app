"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresher({
  table,
  pollMs = 30000,
}: {
  table: string;
  pollMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh()
      )
      .subscribe();

    const interval = setInterval(() => router.refresh(), pollMs);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [table, pollMs, router]);

  return null;
}
