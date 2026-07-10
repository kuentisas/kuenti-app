import { redirect } from "next/navigation";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDurationShort } from "@/lib/format";
import { ActivityDetailDialog, type SessionEntry } from "./activity-detail-dialog";

interface EntryRow {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  clients: { id: string; nombre: string } | null;
  activities: { id: string; nombre: string } | null;
}

export default async function ResumenMesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const { data: raw } = await supabase
    .from("time_entries")
    .select("id, start_time, end_time, duration_seconds, clients(id, nombre), activities(id, nombre)")
    .eq("user_id", user.id)
    .gte("start_time", monthStart.toISOString())
    .lte("start_time", monthEnd.toISOString())
    .not("duration_seconds", "is", null)
    .order("start_time", { ascending: false });

  const entries = (raw ?? []) as unknown as EntryRow[];

  const byClient = new Map<string, { nombre: string; seconds: number }>();
  const byActivity = new Map<
    string,
    { nombre: string; clientNombre: string; seconds: number; sessions: SessionEntry[] }
  >();

  for (const e of entries) {
    const seconds = e.duration_seconds ?? 0;
    if (e.clients) {
      const cur = byClient.get(e.clients.id) ?? { nombre: e.clients.nombre, seconds: 0 };
      cur.seconds += seconds;
      byClient.set(e.clients.id, cur);
    }
    if (e.activities) {
      const cur = byActivity.get(e.activities.id) ?? {
        nombre: e.activities.nombre,
        clientNombre: e.clients?.nombre ?? "—",
        seconds: 0,
        sessions: [],
      };
      cur.seconds += seconds;
      cur.sessions.push({
        id: e.id,
        startTime: e.start_time,
        endTime: e.end_time,
        durationSeconds: seconds,
      });
      byActivity.set(e.activities.id, cur);
    }
  }

  const clientRows = Array.from(byClient.values()).sort((a, b) => b.seconds - a.seconds);
  const activityRows = Array.from(byActivity.entries())
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => b.seconds - a.seconds);

  const mesNombre = now.toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-kuenti-slate">Resumen del mes</h1>
        <p className="text-sm text-muted-foreground">
          Horas trabajadas en {mesNombre}, por cliente y por actividad.
        </p>
      </div>

      <Tabs defaultValue="cliente">
        <TabsList>
          <TabsTrigger value="cliente">Por cliente</TabsTrigger>
          <TabsTrigger value="actividad">Por actividad</TabsTrigger>
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
                        Sin registros este mes.
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

        <TabsContent value="actividad">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Actividad</TableHead>
                    <TableHead className="text-right">Horas totales</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Sin registros este mes.
                      </TableCell>
                    </TableRow>
                  )}
                  {activityRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.clientNombre}</TableCell>
                      <TableCell className="font-medium">{row.nombre}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatDurationShort(row.seconds)}
                      </TableCell>
                      <TableCell>
                        <ActivityDetailDialog
                          activityNombre={row.nombre}
                          clientNombre={row.clientNombre}
                          totalSeconds={row.seconds}
                          sessions={row.sessions}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
