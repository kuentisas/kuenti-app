import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/current-user";
import { canViewFinance } from "@/lib/roles";
import { bogotaDateKey } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet } from "lucide-react";
import { formatDurationShort, secondsToHours } from "@/lib/format";
import { DateRangeForm } from "./date-range-form";
import { resolveReportRange } from "./range";
import { buildTeamBreakdown, type TeamEntryRow } from "./breakdown";

// 42h/semana, misma constante que rentabilidad — jornada legal Colombia.
const HORAS_SEMANA_LEGAL = 42;

type EntryRow = TeamEntryRow;

// Lunes de la semana calendario (hora Bogotá) a la que pertenece la
// fecha, como clave para agrupar horas por semana ISO (aunque el rango
// elegido no calce exacto con semanas completas). Se opera sobre el
// Y-M-D ya resuelto en hora Bogotá, usando UTC solo como calendario
// neutro para la aritmética de días — no representa un instante real.
function mondayOfWeek(d: Date) {
  const [y, m, day] = bogotaDateKey(d).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dow = date.getUTCDay();
  const diff = (dow === 0 ? -6 : 1) - dow;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const profile = await getCurrentUserProfile();
  const canSeeEficiencia = canViewFinance(profile?.role ?? "colaboradora");

  const { fromStr, toStr, fromDate, toDate } = resolveReportRange(searchParams);

  const supabase = createClient();
  const { data: raw } = await supabase
    .from("time_entries")
    .select(
      "duration_seconds, start_time, clients(id, nombre), activities(id, nombre), users(id, nombre, activo, deleted_at)"
    )
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

  // Desglose cliente -> actividad por colaboradora, para el acordeón de
  // "Por miembro del equipo" — misma agregación que usa la exportación a
  // Excel, aplicada acá sobre las entradas ya traídas (sin query extra).
  const teamBreakdown = buildTeamBreakdown(entries).map((member) => ({
    ...member,
    horasExtra: horasExtraByUser.get(member.id) ?? 0,
  }));

  const exportHref = `/admin/reportes/export?from=${fromStr}&to=${toStr}`;

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
          {canSeeEficiencia && <TabsTrigger value="eficiencia">Costo y eficiencia</TabsTrigger>}
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

        <TabsContent value="colaboradora" className="space-y-3">
          <div className="flex items-center justify-end">
            <Button asChild variant="secondary" className="gap-2">
              <a href={exportHref}>
                <FileSpreadsheet className="h-4 w-4" />
                Exportar a Excel
              </a>
            </Button>
          </div>

          {teamBreakdown.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sin registros en el rango seleccionado.
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {teamBreakdown.map((member) => (
                <AccordionItem
                  key={member.id}
                  value={member.id}
                  className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
                >
                  <AccordionTrigger className="border-b bg-secondary/30 px-6 py-3 hover:no-underline">
                    <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2">
                      <span className="text-base font-medium text-kuenti-slate">
                        {member.nombre}
                      </span>
                      <div className="flex items-center gap-3">
                        {member.deleted ? (
                          <Badge variant="destructive">Eliminada</Badge>
                        ) : !member.activo ? (
                          <Badge variant="secondary">Inactiva</Badge>
                        ) : (
                          <Badge variant="success">Activa</Badge>
                        )}
                        <span className="font-mono text-sm">
                          {formatDurationShort(member.seconds)}
                        </span>
                        {member.horasExtra > 0 ? (
                          <Badge variant="warning">{member.horasExtra.toFixed(1)}h extra</Badge>
                        ) : (
                          <span className="font-mono text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 px-6 pb-6 pt-4">
                    {member.clients.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Sin clientes en el rango seleccionado.
                      </p>
                    )}
                    {member.clients.map((client) => (
                      <div key={client.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm font-medium text-kuenti-slate">
                          <span>{client.nombre}</span>
                          <span className="font-mono">{formatDurationShort(client.seconds)}</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8">Actividad</TableHead>
                              <TableHead className="h-8 text-right">Horas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {client.activities.map((activity) => (
                              <TableRow key={activity.id}>
                                <TableCell className="py-1.5 text-muted-foreground">
                                  {activity.nombre}
                                </TableCell>
                                <TableCell className="py-1.5 text-right font-mono">
                                  {formatDurationShort(activity.seconds)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {canSeeEficiencia && (
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
        )}
      </Tabs>
    </div>
  );
}
