import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  CorrectionsHistoryTable,
  type ReviewedCorrectionRow,
} from "./corrections-history-table";

// Las actividades eventuales ya no pasan por aprobación (quedan
// disponibles de inmediato al agregarlas — ver "Actividades eventuales
// agregadas" en el dashboard). Esta pantalla queda solo para el
// historial de correcciones de tiempo, que sigue exigiendo revisión.
export default async function AprobacionesPage() {
  const supabase = createClient();

  const { data: correctionsRaw } = await supabase
    .from("activity_corrections")
    .select(
      "id, estado, fecha_revision, nota_revision, motivo, nueva_hora_fin_sugerida, hora_fin_original, solicitante:users!user_id(nombre), revisor:users!revisado_por(nombre), time_entries(clients(nombre), activities(nombre))"
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
          <CorrectionsHistoryTable corrections={corrections} />
        </CardContent>
      </Card>
    </div>
  );
}
