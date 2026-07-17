import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { bogotaMonthKey, startOfBogotaDay } from "@/lib/dates";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { TimerPanel, type AssignedClient, type TodayEntry } from "./timer-panel";
import {
  ResolvedCorrectionsBanner,
  type ResolvedCorrection,
} from "./resolved-corrections-banner";

interface AssignmentRow {
  clients: {
    id: string;
    nombre: string;
    activo: boolean;
    activities: {
      id: string;
      nombre: string;
      activo: boolean;
      tipo: "recurrente" | "eventual";
      mes_aplicable: string | null;
      estado_aprobacion: "aprobada" | "pendiente" | "rechazada";
      orden: number;
    }[];
  } | null;
}

interface ActiveEntryRow {
  id: string;
  client_id: string;
  activity_id: string;
  start_time: string;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

interface TodayEntryRow {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

interface ResolvedCorrectionRow {
  id: string;
  estado: "aprobada" | "rechazada";
  nota_revision: string | null;
  nueva_hora_fin_sugerida: string;
  fecha_revision: string;
  time_entries: {
    clients: { nombre: string } | null;
    activities: { nombre: string } | null;
  } | null;
}

export default async function PanelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: assignments } = await supabase
    .from("client_assignments")
    .select(
      "clients(id, nombre, activo, activities(id, nombre, activo, tipo, mes_aplicable, estado_aprobacion, orden))"
    )
    .eq("user_id", user.id);

  const currentMonth = `${bogotaMonthKey()}-01`;

  // Además de activo, una actividad solo es utilizable (aparece con botón
  // Start) si está aprobada y, si es eventual, si corresponde al mes
  // actual. RLS ya deja ver la fila si la sugirió la propia colaboradora
  // (para que pueda ver que está "pendiente"), así que este filtro es el
  // que realmente decide si aparece como opción para iniciar timer.
  const clients: AssignedClient[] = (
    ((assignments ?? []) as unknown as AssignmentRow[])
      .map((a) => a.clients)
      .filter((c): c is NonNullable<AssignmentRow["clients"]> => !!c && c.activo)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        activities: c.activities
          .filter(
            (p) =>
              p.activo &&
              p.estado_aprobacion === "aprobada" &&
              (p.tipo === "recurrente" || p.mes_aplicable === currentMonth)
          )
          .sort((a, b) => a.orden - b.orden),
      }))
  );

  const { data: activeEntryRaw } = await supabase
    .from("time_entries")
    .select("id, client_id, activity_id, start_time, clients(nombre), activities(nombre)")
    .eq("user_id", user.id)
    .is("end_time", null)
    .maybeSingle();

  const activeEntry = activeEntryRaw as unknown as ActiveEntryRow | null;

  const startOfDay = startOfBogotaDay();

  const { data: todayEntriesRaw } = await supabase
    .from("time_entries")
    .select(
      "id, start_time, end_time, duration_seconds, clients(nombre), activities(nombre)"
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
    activityNombre: e.activities?.nombre ?? "—",
  }));

  // Regla de recuperación de timer huérfano: si pasaron más de 5 minutos
  // desde start_time, se le exige a la colaboradora resolver el modal
  // obligatorio antes de poder usar el panel — calculado server-side, en
  // el momento exacto de esta carga, para no depender del reloj del
  // navegador.
  const isStale = !!activeEntry && Date.now() - new Date(activeEntry.start_time).getTime() > 5 * 60 * 1000;

  const { data: resolvedCorrectionsRaw } = await supabase
    .from("activity_corrections")
    .select(
      "id, estado, nota_revision, nueva_hora_fin_sugerida, fecha_revision, time_entries(clients(nombre), activities(nombre))"
    )
    .eq("user_id", user.id)
    .neq("estado", "pendiente")
    .eq("visto_por_solicitante", false)
    .order("fecha_revision", { ascending: false });

  const resolvedCorrections: ResolvedCorrection[] = (
    (resolvedCorrectionsRaw ?? []) as unknown as ResolvedCorrectionRow[]
  ).map((c) => ({
    id: c.id,
    estado: c.estado,
    nota_revision: c.nota_revision,
    nueva_hora_fin_sugerida: c.nueva_hora_fin_sugerida,
    fecha_revision: c.fecha_revision,
    clientNombre: c.time_entries?.clients?.nombre ?? "—",
    activityNombre: c.time_entries?.activities?.nombre ?? "—",
  }));

  return (
    <>
      {/* Sin esto, una actividad recién aprobada (o agregada/desactivada
          por el admin) no aparecía hasta que la colaboradora recargara la
          página por su cuenta — y no tenía forma de saber que debía
          hacerlo. Mismo patrón que el dashboard admin. */}
      <RealtimeRefresher table="activities" />
      {/* Para que el badge de correcciones resueltas aparezca sin recargar
          si el admin decide mientras la colaboradora tiene el panel
          abierto. */}
      <RealtimeRefresher table="activity_corrections" />
      {resolvedCorrections.length > 0 && (
        <div className="mb-4">
          <ResolvedCorrectionsBanner corrections={resolvedCorrections} />
        </div>
      )}
      <TimerPanel
        clients={clients}
        activeEntry={
          activeEntry
            ? {
                id: activeEntry.id,
                clientId: activeEntry.client_id,
                activityId: activeEntry.activity_id,
                startTime: activeEntry.start_time,
                clientNombre: activeEntry.clients?.nombre ?? "—",
                activityNombre: activeEntry.activities?.nombre ?? "—",
              }
            : null
        }
        todayEntries={todayEntries}
        initialIsStale={isStale}
      />
    </>
  );
}
