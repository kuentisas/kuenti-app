import { createClient } from "@/lib/supabase/server";
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
import { formatCOP, formatDurationShort, secondsToHours } from "@/lib/format";
import { MonthForm } from "./month-form";
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
  tarifa_mensual: number;
}

function statusFor(costo: number, tarifa: number) {
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
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesStr = searchParams.mes ?? defaultMonth;
  const [year, month] = mesStr.split("-").map(Number);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const supabase = createClient();

  const [{ data: settings }, { data: clientsRaw }, { data: entriesRaw }, { data: salariesRaw }] =
    await Promise.all([
      supabase.from("app_settings").select("costo_hora_promedio").eq("id", true).single(),
      supabase
        .from("clients")
        .select("id, nombre, client_rates(tarifa_mensual)")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("time_entries")
        .select("duration_seconds, client_id, user_id")
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString())
        .not("duration_seconds", "is", null),
      supabase.from("user_salaries").select("user_id, salario_mensual"),
    ]);

  const costoHoraPromedio = settings?.costo_hora_promedio ?? 0;
  const clients = ((clientsRaw ?? []) as unknown as (ClientRow & {
    client_rates: { tarifa_mensual: number | null } | null;
  })[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tarifa_mensual: c.client_rates?.tarifa_mensual ?? 0,
  }));
  const entries = (entriesRaw ?? []) as EntryRow[];

  // Costo/hora real por colaboradora = salario_mensual ÷ 182h. Si no tiene
  // salario cargado todavía, cae al costo_hora_promedio global (fallback
  // ya confirmado, para no romper rentabilidad mientras se cargan salarios
  // gradualmente).
  const costoHoraByUser = new Map<string, number>();
  for (const s of salariesRaw ?? []) {
    if (s.salario_mensual != null) {
      costoHoraByUser.set(s.user_id, s.salario_mensual / HORAS_MES);
    }
  }

  const secondsByClient = new Map<string, number>();
  const costoByClient = new Map<string, number>();
  for (const e of entries) {
    const seconds = e.duration_seconds ?? 0;
    secondsByClient.set(e.client_id, (secondsByClient.get(e.client_id) ?? 0) + seconds);

    const costoHora = costoHoraByUser.get(e.user_id) ?? costoHoraPromedio;
    const costo = secondsToHours(seconds) * costoHora;
    costoByClient.set(e.client_id, (costoByClient.get(e.client_id) ?? 0) + costo);
  }

  const rows = clients.map((client) => {
    const seconds = secondsByClient.get(client.id) ?? 0;
    const horas = secondsToHours(seconds);
    const costo = costoByClient.get(client.id) ?? 0;
    const status = statusFor(costo, client.tarifa_mensual);
    return { client, seconds, horas, costo, status };
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
        <MonthForm defaultMonth={mesStr} />
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
              {rows.map(({ client, seconds, costo, status }) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nombre}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatDurationShort(seconds)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {client.tarifa_mensual > 0 ? formatCOP(client.tarifa_mensual) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCOP(costo)}</TableCell>
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
