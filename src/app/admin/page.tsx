import { Users, Clock, Activity } from "lucide-react";

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
import { LiveDuration } from "@/components/live-duration";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { formatDurationShort } from "@/lib/format";

interface ActiveTimerRow {
  id: string;
  start_time: string;
  users: { nombre: string } | null;
  clients: { nombre: string } | null;
  activities: { nombre: string } | null;
}

export default async function AdminDashboardPage() {
  const supabase = createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

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

  return (
    <div className="space-y-6">
      <RealtimeRefresher table="time_entries" />
      <div>
        <h1 className="text-2xl font-semibold text-kuenti-slate">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de actividad de hoy, {new Date().toLocaleDateString("es-CO", {
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
                <TableHead>Proceso</TableHead>
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
    </div>
  );
}
