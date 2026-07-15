import { createClient } from "@/lib/supabase/server";
import { BOGOTA_TZ, bogotaDateKey, bogotaMonthKey, endOfBogotaMonth, startOfBogotaMonth } from "@/lib/dates";
import { MonthForm } from "@/components/month-form";
import { MonthCalendar, type CalendarSession } from "@/components/month-calendar";
import { ColaboradoraSelect } from "./colaboradora-select";

interface EntryRow {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  estado: string;
  nota_ajuste: string | null;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

export default async function AdminCalendarioPage({
  searchParams,
}: {
  searchParams: { mes?: string; colaboradora?: string };
}) {
  const supabase = createClient();

  const { data: colaboradoras } = await supabase
    .from("users")
    .select("id, nombre")
    .eq("role", "colaboradora")
    .eq("activo", true)
    .is("deleted_at", null)
    .order("nombre");

  const selectedId = searchParams.colaboradora ?? colaboradoras?.[0]?.id ?? "";

  const mesStr = searchParams.mes ?? bogotaMonthKey();
  const [year, month] = mesStr.split("-").map(Number);

  const monthStart = startOfBogotaMonth(mesStr);
  const monthEnd = endOfBogotaMonth(mesStr);

  const sessionsByDay = new Map<string, CalendarSession[]>();

  if (selectedId) {
    const { data: raw } = await supabase
      .from("time_entries")
      .select(
        "id, start_time, end_time, duration_seconds, estado, nota_ajuste, clients(nombre), activities(nombre)"
      )
      .eq("user_id", selectedId)
      .gte("start_time", monthStart.toISOString())
      .lte("start_time", monthEnd.toISOString())
      .not("duration_seconds", "is", null);

    const entries = (raw ?? []) as unknown as EntryRow[];
    for (const e of entries) {
      const dateKey = bogotaDateKey(e.start_time);
      const list = sessionsByDay.get(dateKey) ?? [];
      list.push({
        id: e.id,
        clientNombre: e.clients?.nombre ?? "—",
        activityNombre: e.activities?.nombre ?? "—",
        startTime: e.start_time,
        endTime: e.end_time,
        durationSeconds: e.duration_seconds ?? 0,
        ajustadoManualmente: e.estado === "ajustado_manualmente",
        notaAjuste: e.nota_ajuste,
      });
      sessionsByDay.set(dateKey, list);
    }
  }

  const mesNombre = monthStart.toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TZ,
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-kuenti-slate">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Qué trabajó cada miembro del equipo y en qué horario, día por día — {mesNombre}.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <ColaboradoraSelect colaboradoras={colaboradoras ?? []} selectedId={selectedId} />
        <MonthForm defaultMonth={mesStr} basePath="/admin/calendario" extraParams={{ colaboradora: selectedId }} />
      </div>

      {!selectedId ? (
        <p className="text-sm text-muted-foreground">No hay miembros del equipo activos.</p>
      ) : (
        <MonthCalendar year={year} month={month} sessionsByDay={sessionsByDay} />
      )}
    </div>
  );
}
