import { Users, Clock, Activity, Lightbulb, Pencil, AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { BOGOTA_TZ, bogotaMonthKey, endOfBogotaMonth, startOfBogotaDay, startOfBogotaMonth } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthForm } from "@/components/month-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LiveDuration } from "@/components/live-duration";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { formatDurationShort } from "@/lib/format";
import { ActivityApprovalActions } from "./activity-approval-actions";
import { CorrectionApprovalActions } from "./correction-approval-actions";
import { AdjustmentsColaboradoraSelect } from "./adjustments-colaboradora-select";

interface ActiveTimerRow {
  id: string;
  start_time: string;
  users: { nombre: string } | null;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

interface PendingActivityRow {
  id: string;
  nombre: string;
  motivo: string | null;
  created_at: string;
  clients: { nombre: string } | null;
  users: { nombre: string } | null;
}

interface PendingCorrectionRow {
  id: string;
  motivo: string;
  nueva_hora_fin_sugerida: string;
  created_at: string;
  users: { nombre: string } | null;
  time_entries: {
    start_time: string;
    end_time: string | null;
    clients: { nombre: string } | null;
    activities: { nombre: string } | null;
  } | null;
}

interface AutoClosedRow {
  id: string;
  start_time: string;
  end_time: string | null;
  users: { nombre: string } | null;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

interface ManualAdjustmentRow {
  id: string;
  start_time: string;
  end_time: string | null;
  nota_ajuste: string | null;
  users: { nombre: string } | null;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { mes?: string; colaborador?: string };
}) {
  const supabase = createClient();

  const mesAjustesStr = searchParams.mes ?? bogotaMonthKey();
  const ajustesMonthStart = startOfBogotaMonth(mesAjustesStr);
  const ajustesMonthEnd = endOfBogotaMonth(mesAjustesStr);
  const colaboradorFiltroId = searchParams.colaborador ?? "";

  const startOfDay = startOfBogotaDay();

  const { data: todayEntries } = await supabase
    .from("time_entries")
    .select("user_id, duration_seconds, start_time")
    .gte("start_time", startOfDay.toISOString());

  const activeColabsToday = new Set((todayEntries ?? []).map((e) => e.user_id)).size;
  const totalSecondsToday = (todayEntries ?? []).reduce(
    (sum, e) => sum + (e.duration_seconds ?? 0),
    0
  );

  const { data: activeTimersRaw } = await supabase
    .from("time_entries")
    .select("id, start_time, users(nombre), clients(nombre), activities(nombre)")
    .is("end_time", null)
    .order("start_time", { ascending: true });

  const activeTimers = (activeTimersRaw ?? []) as unknown as ActiveTimerRow[];

  const { data: pendingActivitiesRaw } = await supabase
    .from("activities")
    .select("id, nombre, motivo, created_at, clients(nombre), users!sugerida_por(nombre)")
    .eq("estado_aprobacion", "pendiente")
    .order("created_at", { ascending: true });

  const pendingActivities = (pendingActivitiesRaw ?? []) as unknown as PendingActivityRow[];

  const { data: pendingCorrectionsRaw } = await supabase
    .from("activity_corrections")
    .select(
      "id, motivo, nueva_hora_fin_sugerida, created_at, users!user_id(nombre), time_entries(start_time, end_time, clients(nombre), activities(nombre))"
    )
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  const pendingCorrections = (pendingCorrectionsRaw ?? []) as unknown as PendingCorrectionRow[];

  const { data: autoClosedRaw } = await supabase
    .from("time_entries")
    .select("id, start_time, end_time, users(nombre), clients(nombre), activities(nombre)")
    .eq("estado", "cerrado_automaticamente")
    .order("start_time", { ascending: false })
    .limit(20);

  const autoClosed = (autoClosedRaw ?? []) as unknown as AutoClosedRow[];

  const { data: colaboradorasParaFiltro } = await supabase
    .from("users")
    .select("id, nombre")
    .eq("role", "colaboradora")
    .eq("activo", true)
    .is("deleted_at", null)
    .order("nombre");

  let manualAdjustmentsQuery = supabase
    .from("time_entries")
    .select("id, start_time, end_time, nota_ajuste, users(nombre), clients(nombre), activities(nombre)")
    .eq("estado", "ajustado_manualmente")
    .gte("start_time", ajustesMonthStart.toISOString())
    .lte("start_time", ajustesMonthEnd.toISOString())
    .order("start_time", { ascending: false })
    .limit(200);

  if (colaboradorFiltroId) {
    manualAdjustmentsQuery = manualAdjustmentsQuery.eq("user_id", colaboradorFiltroId);
  }

  const { data: manualAdjustmentsRaw } = await manualAdjustmentsQuery;

  const manualAdjustments = (manualAdjustmentsRaw ?? []) as unknown as ManualAdjustmentRow[];

  const mesAjustesNombre = ajustesMonthStart.toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TZ,
    month: "long",
    year: "numeric",
  });

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: BOGOTA_TZ,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <RealtimeRefresher table="time_entries" />
      <div>
        <h1 className="text-2xl font-semibold text-kuenti-slate">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de actividad de hoy, {new Date().toLocaleDateString("es-CO", {
            timeZone: BOGOTA_TZ,
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Equipo activo hoy
            </CardTitle>
            <Users className="h-4 w-4 text-kuenti-slate" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeColabsToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Horas registradas hoy
            </CardTitle>
            <Clock className="h-4 w-4 text-kuenti-slate" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatDurationShort(totalSecondsToday)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Timers activos ahora
            </CardTitle>
            <Activity className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeTimers.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="relative flex h-2.5 w-2.5">
              {activeTimers.length > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              )}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            Timers en tiempo real
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Miembro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Tiempo transcurrido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeTimers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay timers activos en este momento.
                  </TableCell>
                </TableRow>
              )}
              {activeTimers.map((timer) => (
                <TableRow key={timer.id}>
                  <TableCell className="font-medium">
                    {timer.users?.nombre ?? "—"}
                  </TableCell>
                  <TableCell>{timer.clients?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{timer.activities?.nombre ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(timer.start_time).toLocaleTimeString("es-CO", {
                      timeZone: BOGOTA_TZ,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <LiveDuration startTime={timer.start_time} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-accent" />
            Actividades pendientes de aprobación
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Sugerida por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingActivities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay actividades pendientes de aprobación.
                  </TableCell>
                </TableRow>
              )}
              {pendingActivities.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.clients?.nombre ?? "—"}</TableCell>
                  <TableCell className="font-medium">{a.nombre}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {a.motivo ?? "—"}
                  </TableCell>
                  <TableCell>{a.users?.nombre ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(a.created_at)}
                  </TableCell>
                  <TableCell>
                    <ActivityApprovalActions activityId={a.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-accent" />
            Correcciones pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Miembro</TableHead>
                <TableHead>Cliente / Actividad</TableHead>
                <TableHead>Hora actual → sugerida</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingCorrections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay correcciones pendientes.
                  </TableCell>
                </TableRow>
              )}
              {pendingCorrections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.users?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    {c.time_entries?.clients?.nombre ?? "—"} ·{" "}
                    {c.time_entries?.activities?.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.time_entries?.end_time ? formatDateTime(c.time_entries.end_time) : "—"}
                    {" → "}
                    {formatDateTime(c.nueva_hora_fin_sugerida)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {c.motivo}
                  </TableCell>
                  <TableCell>
                    <CorrectionApprovalActions correctionId={c.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Timers cerrados automáticamente — requieren revisión
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Miembro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Cierre automático</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {autoClosed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay timers cerrados automáticamente.
                  </TableCell>
                </TableRow>
              )}
              {autoClosed.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.users?.nombre ?? "—"}</TableCell>
                  <TableCell>{t.clients?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t.activities?.nombre ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(t.start_time)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.end_time ? formatDateTime(t.end_time) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-warning-foreground" />
            Ajustes manuales — {mesAjustesNombre}
          </CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <MonthForm
              defaultMonth={mesAjustesStr}
              basePath="/admin"
              extraParams={colaboradorFiltroId ? { colaborador: colaboradorFiltroId } : undefined}
            />
            <AdjustmentsColaboradoraSelect
              colaboradoras={colaboradorasParaFiltro ?? []}
              selectedId={colaboradorFiltroId}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Miembro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin (ajustado)</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manualAdjustments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay ajustes manuales en {mesAjustesNombre}
                    {colaboradorFiltroId
                      ? ` para ${colaboradorasParaFiltro?.find((c) => c.id === colaboradorFiltroId)?.nombre ?? "esta colaboradora"}`
                      : ""}
                    .
                  </TableCell>
                </TableRow>
              )}
              {manualAdjustments.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.users?.nombre ?? "—"}</TableCell>
                  <TableCell>{m.clients?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.activities?.nombre ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(m.start_time)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.end_time ? formatDateTime(m.end_time) : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {m.nota_ajuste ?? "—"}
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
