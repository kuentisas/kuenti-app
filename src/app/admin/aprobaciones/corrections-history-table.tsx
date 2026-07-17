"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BOGOTA_TZ } from "@/lib/dates";

export interface ReviewedCorrectionRow {
  id: string;
  estado: "aprobada" | "rechazada";
  fecha_revision: string;
  nota_revision: string | null;
  motivo: string;
  nueva_hora_fin_sugerida: string;
  hora_fin_original: string | null;
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

function formatHora(iso: string | null) {
  if (!iso) return "—";
  return formatDateTime(iso);
}

export function CorrectionsHistoryTable({
  corrections,
}: {
  corrections: ReviewedCorrectionRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente / Actividad</TableHead>
          <TableHead>Solicitada por</TableHead>
          <TableHead>Revisada por</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Resultado</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {corrections.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Sin correcciones revisadas todavía.
            </TableCell>
          </TableRow>
        )}
        {corrections.map((c) => {
          const isExpanded = expandedId === c.id;
          return (
            <Fragment key={c.id}>
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
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
                <TableCell>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow key={`${c.id}-detail`} className="bg-secondary/30 hover:bg-secondary/30">
                  <TableCell colSpan={6}>
                    <div className="grid gap-x-6 gap-y-2 py-2 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Hora original: </span>
                        {formatHora(c.hora_fin_original)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Hora {c.estado === "aprobada" ? "aprobada" : "sugerida"}:{" "}
                        </span>
                        {formatHora(c.nueva_hora_fin_sugerida)}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Motivo de la colaboradora: </span>
                        {c.motivo}
                      </div>
                      {c.estado === "rechazada" && (
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground">Nota de revisión: </span>
                          {c.nota_revision ?? "—"}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
