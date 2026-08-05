import ExcelJS from "exceljs";

import { createClient } from "@/lib/supabase/server";
import { formatDurationShort } from "@/lib/format";
import { resolveReportRange } from "../range";
import { buildTeamBreakdown, type TeamEntryRow } from "../breakdown";

// Mismo cliente (RLS, sesión por cookies) que usa la página — is_admin_or_
// supervisor() ya deja ver todo el equipo vía RLS; sin esto, una
// colaboradora que pegue esta URL solo recibiría sus propias filas, igual
// que hoy en pantalla. No hace falta service_role ni requireRole() acá.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { fromStr, toStr, fromDate, toDate } = resolveReportRange({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const supabase = createClient();
  const { data: raw } = await supabase
    .from("time_entries")
    .select(
      "duration_seconds, start_time, clients(id, nombre), activities(id, nombre), users(id, nombre, activo, deleted_at)"
    )
    .gte("start_time", fromDate.toISOString())
    .lte("start_time", toDate.toISOString())
    .not("duration_seconds", "is", null);

  const entries = (raw ?? []) as unknown as TeamEntryRow[];
  const team = buildTeamBreakdown(entries).filter((m) => m.activo && !m.deleted);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Por miembro del equipo");
  sheet.columns = [
    { header: "Miembro del equipo", key: "miembro", width: 28 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Actividad", key: "actividad", width: 40 },
    { header: "Horas del mes", key: "horas", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const member of team) {
    for (const client of member.clients) {
      for (const activity of client.activities) {
        sheet.addRow({
          miembro: member.nombre,
          cliente: client.nombre,
          actividad: activity.nombre,
          horas: formatDurationShort(activity.seconds),
        });
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `reporte-equipo_${fromStr}_a_${toStr}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
