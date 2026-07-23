import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMesVigencia } from "@/lib/vigencia";

export interface HistorialVigenciaRow {
  id: string;
  valor: number;
  vigente_desde: string;
  es_correccion: boolean;
}

// Solo lectura: qué valor aplicó cada mes y si fue una corrección
// retroactiva o un cambio real — reutilizado para tarifa de cliente y
// salario de colaboradora, mismo shape de fila en ambos casos.
export function HistorialVigenciaTable({
  historial,
  formatValor,
  emptyLabel,
}: {
  historial: HistorialVigenciaRow[];
  formatValor: (valor: number) => string;
  emptyLabel: string;
}) {
  if (historial.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vigente desde</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Origen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {historial.map((h) => (
          <TableRow key={h.id}>
            <TableCell className="text-muted-foreground">
              {formatMesVigencia(h.vigente_desde)}
            </TableCell>
            <TableCell className="text-right font-mono">{formatValor(h.valor)}</TableCell>
            <TableCell>
              {h.es_correccion ? (
                <Badge variant="warning">Corrección</Badge>
              ) : (
                <Badge variant="secondary">Cambio normal</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
