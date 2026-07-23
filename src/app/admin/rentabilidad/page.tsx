import { createClient } from "@/lib/supabase/server";
import { bogotaMonthKey, endOfBogotaMonth, startOfBogotaMonth } from "@/lib/dates";
import { vigenteEnMes } from "@/lib/vigencia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCOP, formatDurationShort, secondsToHours } from "@/lib/format";
import { MonthForm } from "@/components/month-form";
import { SettingsForm } from "./settings-form";

// 42h/semana × 52 semanas ÷ 12 meses ≈ 182h/mes. Constante fija (no
// prorrateada por días del mes) — decisión ya confirmada.
const HORAS_MES = (42 * 52) / 12;

interface EntryRow {
  duration_seconds: number | null;
  client_id: string;
  user_id: string;
}

interface ClientRow {
  id: string;
  nombre: string;
}

function statusFor(seconds: number, costo: number, tarifa: number) {
  if (seconds === 0) {
    return { label: "Sin actividad este mes", variant: "secondary" as const };
  }
  if (tarifa <= 0) {
    return { label: "Sin tarifa configurada", variant: "secondary" as const };
  }
  const ratio = costo / tarifa;
  if (ratio >= 1) return { label: "En pérdida", variant: "destructive" as const };
  if (ratio >= 0.8) return { label: "Neutro (alerta 80%)", variant: "warning" as const };
  return { label: "Rentable", variant: "success" as const };
}

export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const mesStr = searchParams.mes ?? bogotaMonthKey();
  const [year, month] = mesStr.split("-").map(Number);

  const monthStart = startOfBogotaMonth(mesStr);
  const monthEnd = endOfBogotaMonth(mesStr);

  const supabase = createClient();

  const [{ data: settings }, { data: clientsRaw }, { data: entriesRaw }, { data: rateHistoryRaw }, { data: salaryHistoryRaw }] =
    await Promise.all([
      supabase.from("app_settings").select("costo_hora_promedio").eq("id", true).single(),
      supabase.from("clients").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("time_entries")
        .select("duration_seconds, client_id, user_id")
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString())
        .not("duration_seconds", "is", null),
      // Se trae TODO el historial (no solo "lo vigente hoy") porque
      // rentabilidad puede consultar un mes pasado: el valor correcto para
      // ese mes es el vigente EN ESE MOMENTO, no el actual.
      supabase.from("client_rate_history").select("client_id, tarifa_mensual, vigente_desde"),
      supabase.from("user_salary_history").select("user_id, salario_mensual, vigente_desde"),
    ]);

  const costoHoraPromedio = settings?.costo_hora_promedio ?? 0;

  const tarifaVigenteByClient = vigenteEnMes(rateHistoryRaw ?? [], (r) => r.client_id, mesStr);
  const clients = ((clientsRaw ?? []) as ClientRow[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tarifa_mensual: tarifaVigenteByClient.get(c.id)?.tarifa_mensual ?? 0,
  }));
  const entries = (entriesRaw ?? []) as EntryRow[];

  // Costo/hora real por colaboradora = salario_mensual (vigente en ESTE
  // mes, no el más reciente) ÷ 182h. Si no tenía salario vigente ese mes
  // todavía, cae al costo_hora_promedio global (fallback ya confirmado,
  // para no romper rentabilidad mientras se cargan salarios gradualmente).
  const salarioVigenteByUser = vigenteEnMes(salaryHistoryRaw ?? [], (r) => r.user_id, mesStr);
  const costoHoraByUser = new Map<string, number>();
  for (const [userId, row] of salarioVigenteByUser) {
    costoHoraByUser.set(userId, row.salario_mensual / HORAS_MES);
  }

  const secondsByClient = new Map<string, number>();
  const costoByClient = new Map<string, number>();
  // Por cliente: si alguna hora se costeó con salario real y/o con el
  // promedio genérico (fallback) — un mismo cliente puede tener horas de
  // varias colaboradoras, unas con salario cargado y otras sin él.
  const hasRealByClient = new Map<string, boolean>();
  const hasEstimatedByClient = new Map<string, boolean>();
  for (const e of entries) {
    const seconds = e.duration_seconds ?? 0;
    secondsByClient.set(e.client_id, (secondsByClient.get(e.client_id) ?? 0) + seconds);

    const costoHoraReal = costoHoraByUser.get(e.user_id);
    const costoHora = costoHoraReal ?? costoHoraPromedio;
    const costo = secondsToHours(seconds) * costoHora;
    costoByClient.set(e.client_id, (costoByClient.get(e.client_id) ?? 0) + costo);

    if (costoHoraReal != null) {
      hasRealByClient.set(e.client_id, true);
    } else {
      hasEstimatedByClient.set(e.client_id, true);
    }
  }

  const rows = clients.map((client) => {
    const seconds = secondsByClient.get(client.id) ?? 0;
    const horas = secondsToHours(seconds);
    const costo = costoByClient.get(client.id) ?? 0;
    const status = statusFor(seconds, costo, client.tarifa_mensual);
    const hasReal = hasRealByClient.get(client.id) ?? false;
    const hasEstimated = hasEstimatedByClient.get(client.id) ?? false;
    const costoTipo: "real" | "estimado" | "mixto" | null = hasEstimated
      ? hasReal
        ? "mixto"
        : "estimado"
      : hasReal
        ? "real"
        : null;
    return { client, seconds, horas, costo, status, costoTipo };
  });

  const enPerdida = rows.filter((r) => r.status.label === "En pérdida").length;
  const enAlerta = rows.filter((r) => r.status.label.startsWith("Neutro")).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-kuenti-slate">Rentabilidad</h1>
        <p className="text-sm text-muted-foreground">
          Tarifa mensual vs. costo estimado de horas dedicadas por cliente.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <MonthForm defaultMonth={mesStr} basePath="/admin/rentabilidad" />
        <SettingsForm initialValue={costoHoraPromedio} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes en pérdida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{enPerdida}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes en alerta (&gt;80%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning-foreground">{enAlerta}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total clientes evaluados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Horas dedicadas</TableHead>
                <TableHead className="text-right">Tarifa mensual</TableHead>
                <TableHead className="text-right">Costo estimado</TableHead>
                <TableHead className="text-right">% de la tarifa</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay clientes activos para evaluar.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ client, seconds, costo, status, costoTipo }) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nombre}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatDurationShort(seconds)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {client.tarifa_mensual > 0 ? formatCOP(client.tarifa_mensual) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <div className="flex items-center justify-end gap-1.5">
                      {formatCOP(costo)}
                      {costoTipo === "estimado" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-default text-[10px]">
                              estimado
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Ningún miembro del equipo con horas en este cliente tiene salario
                            cargado — se usó el costo hora promedio.
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {costoTipo === "mixto" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-default text-[10px]">
                              parcial
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Incluye horas de miembros del equipo sin salario cargado, costeadas
                            con el promedio genérico.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {client.tarifa_mensual > 0
                      ? `${Math.round((costo / client.tarifa_mensual) * 100)}%`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
