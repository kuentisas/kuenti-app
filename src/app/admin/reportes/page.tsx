import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDurationShort, secondsToHours } from "@/lib/format";
import { DateRangeForm } from "./date-range-form";

// 42h/semana, misma constante que rentabilidad — jornada legal Colombia.
const HORAS_SEMANA_LEGAL = 42;

interface EntryRow {
  duration_seconds: number | null;
  start_time: string;
  clients: { id: string; nombre: string } | null;
  users: {
    id: string;
    nombre: string;
    activo: boolean;
    deleted_at: string | null;
  } | null;
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Lunes de la semana calendario a la que pertenece la fecha, como clave
// para agrupar horas por semana ISO (aunque el rango elegido no calce
// exacto con semanas completas).
function mondayOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = now;

  const fromStr = searchParams.from ?? toDateInputValue(defaultFrom);
  const toStr = searchParams.to ?? toDateInputValue(defaultTo);

  const fromDate = new Date(`${fromStr}T00:00:00`);
  const toDate = new Date(`${toStr}T23:59:59.999`);

  const supabase = createClient();
  const { data: raw } = await supabase
    .from("time_entries")
    .select("duration_seconds, start_time, clients(id, nombre), users(id, nombre, activo, deleted_at)")
    .gte("start_time", fromDate.toISOString())
    .lte("start_time", toDate.toISOString())
    .not("duration_seconds", "is", null);

  const entries = (raw ?? []) as unknown as EntryRow[];

  const byClient = new Map<string, { nombre: string; seconds: number }>();
  const byUser = new Map<
    string,
    { nombre: string; seconds: number; activo: boolean; deleted: boolean }
  >();
  const weeklySecondsByUser = new Map<string, Map<string, number>>();

  for (const e of entries) {
    const seconds = e.duration_seconds ?? 0;
    if (e.clients) {
      const cur = byClient.get(e.clients.id) ?? { nombre: e.clients.nombre, seconds: 0 };
      cur.seconds += seconds;
      byClient.set(e.clients.id, cur);
    }
    if (e.users) {
      const cur = byUser.get(e.users.id) ?? {
        nombre: e.users.nombre,
        seconds: 0,
        activo: e.users.activo,
        deleted: !!e.users.deleted_at,
      };
      cur.seconds += seconds;
      byUser.set(e.users.id, cur);

      const weekKey = mondayOfWeek(new Date(e.start_time));
      const weeks = weeklySecondsByUser.get(e.users.id) ?? new Map<string, number>();
      weeks.set(weekKey, (weeks.get(weekKey) ?? 0) + seconds);
      weeklySecondsByUser.set(e.users.id, weeks);
    }
  }

  // Horas extra: por cada semana calendario dentro del rango, lo que pase
  // de 42h para esa colaboradora, sumado. Semanal porque la jornada legal
  // es semanal, no importa cómo se recorte el rango del reporte.
  const horasExtraByUser = new Map<string, number>();
  for (const [userId, weeks] of weeklySecondsByUser) {
    let extra = 0;
    for (const seconds of weeks.values()) {
      extra += Math.max(0, secondsToHours(seconds) - HORAS_SEMANA_LEGAL);
    }
    horasExtraByUser.set(userId, extra);
  }

  // Horas pagadas del período: prorrateo de 42h/semana sobre los días del
  // rango elegido (no necesariamente un mes/semanas completas).
  const diasRango = Math.max(
    1,
    Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const horasPagadasPeriodo = (HORAS_SEMANA_LEGAL / 7) * diasRango;

  const clientRows = Array.from(byClient.values()).sort((a, b) => b.seconds - a.seconds);
  const userRows = Array.from(byUser.entries())
    .map(([id, row]) => ({ id, ...row, horasExtra: horasExtraByUser.get(id) ?? 0 }))
    .sort((a, b) => b.seconds - a.seconds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-kuenti-slate">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Horas registradas por cliente y por miembro del equipo en el rango seleccionado.
        </p>
      </div>

      <DateRangeForm defaultFrom={fromStr} defaultTo={toStr} />

      <Tabs defaultValue="cliente">
        <TabsList>
          <TabsTrigger value="cliente">Por cliente</TabsTrigger>
          <TabsTrigger value="colaboradora">Por miembro del equipo</TabsTrigger>
          <TabsTrigger value="eficiencia">Costo y eficiencia</TabsTrigger>
        </TabsList>

        <TabsContent value="cliente">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Horas totales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Sin registros en el rango seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                  {clientRows.map((row) => (
                    <TableRow key={row.nombre}>
                      <TableCell className="font-medium">{row.nombre}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatDurationShort(row.seconds)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colaboradora">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Horas totales</TableHead>
                    <TableHead className="text-right">Horas extra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Sin registros en el rango seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                  {userRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.nombre}</TableCell>
                      <TableCell>
                        {row.deleted ? (
                          <Badge variant="destructive">Eliminada</Badge>
                        ) : !row.activo ? (
                          <Badge variant="secondary">Inactiva</Badge>
                        ) : (
                          <Badge variant="success">Activa</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatDurationShort(row.seconds)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.horasExtra > 0 ? (
                          <Badge variant="warning">{row.horasExtra.toFixed(1)}h extra</Badge>
                        ) : (
                          <span className="font-mono text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eficiencia">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead className="text-right">Horas facturables</TableHead>
                    <TableHead className="text-right">Horas pagadas (período)</TableHead>
                    <TableHead className="text-right">% utilización</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Sin registros en el rango seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                  {userRows.map((row) => {
                    const horas = secondsToHours(row.seconds);
                    const pct = horasPagadasPeriodo > 0 ? (horas / horasPagadasPeriodo) * 100 : 0;
                    const estado =
                      pct < 80
                        ? { label: "Sub-utilización", variant: "warning" as const }
                        : pct > 100
                          ? { label: "Sobre-utilización", variant: "destructive" as const }
                          : { label: "Normal", variant: "success" as const };
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.nombre}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatDurationShort(row.seconds)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {horasPagadasPeriodo.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {pct.toFixed(0)}%
                        </TableCell>
                        <TableCell>
                          <Badge variant={estado.variant}>{estado.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
