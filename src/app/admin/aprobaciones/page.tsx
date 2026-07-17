import { createClient } from "@/lib/supabase/server";
import { BOGOTA_TZ } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReviewedCorrectionRow {
  id: string;
  estado: "aprobada" | "rechazada";
  fecha_revision: string;
  nota_revision: string | null;
  solicitante: { nombre: string } | null;
  revisor: { nombre: string } | null;
  time_entries: {
    clients: { nombre: string } | null;
    activities: { nombre: string } | null;
  } | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: BOGOTA_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Las actividades eventuales ya no pasan por aprobación (quedan
// disponibles de inmediato al agregarlas — ver "Actividades eventuales
// agregadas" en el dashboard). Esta pantalla queda solo para el
// historial de correcciones de tiempo, que sigue exigiendo revisión.
export default async function AprobacionesPage() {
  const supabase = createClient();

  const { data: correctionsRaw } = await supabase
    .from("activity_corrections")
    .select(
      "id, estado, fecha_revision, nota_revision, solicitante:users!user_id(nombre), revisor:users!revisado_por(nombre), time_entries(clients(nombre), activities(nombre))"
    )
    .neq("estado", "pendiente")
    .order("fecha_revision", { ascending: false })
    .limit(100);

  const corrections = (correctionsRaw ?? []) as unknown as ReviewedCorrectionRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-kuenti-slate">Historial de aprobaciones</h1>
        <p className="text-sm text-muted-foreground">
          Correcciones de tiempo ya revisadas — quién decidió, cuándo y con qué resultado.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / Actividad</TableHead>
                <TableHead>Solicitada por</TableHead>
                <TableHead>Revisada por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corrections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Sin correcciones revisadas todavía.
                  </TableCell>
                </TableRow>
              )}
              {corrections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.time_entries?.clients?.nombre ?? "—"} ·{" "}
                    {c.time_entries?.activities?.nombre ?? "—"}
                  </TableCell>
                  <TableCell>{c.solicitante?.nombre ?? "—"}</TableCell>
                  <TableCell>{c.revisor?.nombre ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(c.fecha_revision)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.estado === "aprobada" ? "success" : "destructive"}>
                      {c.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                    </Badge>
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
