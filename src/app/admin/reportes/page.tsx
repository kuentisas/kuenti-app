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
import { formatDurationShort } from "@/lib/format";
import { DateRangeForm } from "./date-range-form";

interface EntryRow {
  duration_seconds: number | null;
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
    .select("duration_seconds, clients(id, nombre), users(id, nombre, activo, deleted_at)")
    .gte("start_time", fromDate.toISOString())
    .lte("start_time", toDate.toISOString())
    .not("duration_seconds", "is", null);

  const entries = (raw ?? []) as unknown as EntryRow[];

  const byClient = new Map<string, { nombre: string; seconds: number }>();
  const byUser = new Map<
    string,
    { nombre: string; seconds: number; activo: boolean; deleted: boolean }
  >();

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
    }
  }

  const clientRows = Array.from(byClient.values()).sort((a, b) => b.seconds - a.seconds);
  const userRows = Array.from(byUser.values()).sort((a, b) => b.seconds - a.seconds);

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Sin registros en el rango seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                  {userRows.map((row) => (
                    <TableRow key={row.nombre}>
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
