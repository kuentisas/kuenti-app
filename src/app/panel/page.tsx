import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { TimerPanel, type AssignedClient, type TodayEntry } from "./timer-panel";

interface AssignmentRow {
  clients: {
    id: string;
    nombre: string;
    activo: boolean;
    processes: { id: string; nombre: string; activo: boolean }[];
  } | null;
}

interface ActiveEntryRow {
  id: string;
  client_id: string;
  process_id: string;
  start_time: string;
  clients: { nombre: string } | null;
  processes: { nombre: string } | null;
}

interface TodayEntryRow {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  clients: { nombre: string } | null;
  processes: { nombre: string } | null;
}

export default async function PanelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: assignments } = await supabase
    .from("client_assignments")
    .select("clients(id, nombre, activo, processes(id, nombre, activo))")
    .eq("user_id", user.id);

  const clients: AssignedClient[] = (
    ((assignments ?? []) as unknown as AssignmentRow[])
      .map((a) => a.clients)
      .filter((c): c is NonNullable<AssignmentRow["clients"]> => !!c && c.activo)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        processes: c.processes.filter((p) => p.activo),
      }))
  );

  const { data: activeEntryRaw } = await supabase
    .from("time_entries")
    .select("id, client_id, process_id, start_time, clients(nombre), processes(nombre)")
    .eq("user_id", user.id)
    .is("end_time", null)
    .maybeSingle();

  const activeEntry = activeEntryRaw as unknown as ActiveEntryRow | null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todayEntriesRaw } = await supabase
    .from("time_entries")
    .select(
      "id, start_time, end_time, duration_seconds, clients(nombre), processes(nombre)"
    )
    .eq("user_id", user.id)
    .gte("start_time", startOfDay.toISOString())
    .order("start_time", { ascending: false });

  const todayEntries: TodayEntry[] = (
    (todayEntriesRaw ?? []) as unknown as TodayEntryRow[]
  ).map((e) => ({
    id: e.id,
    startTime: e.start_time,
    endTime: e.end_time,
    durationSeconds: e.duration_seconds,
    clientNombre: e.clients?.nombre ?? "—",
    processNombre: e.processes?.nombre ?? "—",
  }));

  return (
    <TimerPanel
      clients={clients}
      activeEntry={
        activeEntry
          ? {
              id: activeEntry.id,
              clientId: activeEntry.client_id,
              processId: activeEntry.process_id,
              startTime: activeEntry.start_time,
              clientNombre: activeEntry.clients?.nombre ?? "—",
              processNombre: activeEntry.processes?.nombre ?? "—",
            }
          : null
      }
      todayEntries={todayEntries}
    />
  );
}
