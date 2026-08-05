import ExcelJS from "exceljs";

import { createClient } from "@/lib/supabase/server";
import { formatDurationShort } from "@/lib/format";
import { BOGOTA_TZ, bogotaMonthKey, endOfBogotaMonth, startOfBogotaMonth } from "@/lib/dates";

interface EntryRow {
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", {
    timeZone: BOGOTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "agosto de 2026" (formato largo de Intl) -> "Agosto 2026", para el
// encabezado del archivo y como insumo del nombre de archivo.
function formatMonthLabel(monthStart: Date) {
  const raw = monthStart.toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TZ,
    month: "long",
    year: "numeric",
  });
  const sinDe = raw.replace(" de ", " ");
  return sinDe.charAt(0).toUpperCase() + sinDe.slice(1);
}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Mismo cliente (RLS, sesión por cookies) que usa la página — sin
// service_role ni requireRole(), igual que /admin/reportes/export.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const colaboradoraId = searchParams.get("colaboradora");
  if (!colaboradoraId) {
    return new Response("Falta el parámetro colaboradora", { status: 400 });
  }
  const mesStr = searchParams.get("mes") ?? bogotaMonthKey();

  const monthStart = startOfBogotaMonth(mesStr);
  const monthEnd = endOfBogotaMonth(mesStr);

  const supabase = createClient();
  const [{ data: colaboradora }, { data: raw }] = await Promise.all([
    supabase.from("users").select("nombre").eq("id", colaboradoraId).single(),
    supabase
      .from("time_entries")
      .select("start_time, end_time, duration_seconds, clients(nombre), activities(nombre)")
      .eq("user_id", colaboradoraId)
      .gte("start_time", monthStart.toISOString())
      .lte("start_time", monthEnd.toISOString())
      .not("duration_seconds", "is", null),
  ]);

  const colaboradoraNombre = colaboradora?.nombre ?? "Miembro del equipo";
  const mesLabel = formatMonthLabel(monthStart);

  const entries = ((raw ?? []) as unknown as EntryRow[]).sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Calendario");
  sheet.columns = [
    { key: "fecha", width: 14 },
    { key: "cliente", width: 28 },
    { key: "actividad", width: 40 },
    { key: "inicio", width: 14 },
    { key: "fin", width: 14 },
    { key: "duracion", width: 14 },
  ];

  sheet.mergeCells("A1:F1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `${colaboradoraNombre} — ${mesLabel}`;
  titleCell.font = { bold: true, size: 13 };

  const headerRow = sheet.getRow(2);
  headerRow.values = ["Fecha", "Cliente", "Actividad", "Hora inicio", "Hora fin", "Duración"];
  headerRow.font = { bold: true };

  entries.forEach((e, i) => {
    sheet.getRow(3 + i).values = [
      formatDate(e.start_time),
      e.clients?.nombre ?? "—",
      e.activities?.nombre ?? "—",
      formatClock(e.start_time),
      e.end_time ? formatClock(e.end_time) : "—",
      formatDurationShort(e.duration_seconds ?? 0),
    ];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `calendario_${slugify(colaboradoraNombre)}_${slugify(mesLabel)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
