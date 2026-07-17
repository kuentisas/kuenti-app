"use client";

import { useState, useTransition } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BOGOTA_TZ } from "@/lib/dates";
import { markCorrectionsSeen } from "./actions";

export interface ResolvedCorrection {
  id: string;
  estado: "aprobada" | "rechazada";
  nota_revision: string | null;
  nueva_hora_fin_sugerida: string;
  fecha_revision: string;
  clientNombre: string;
  activityNombre: string;
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

// Sin infraestructura de notificaciones (push/email): el "aviso" es un
// badge que se limpia cuando la colaboradora efectivamente abre el
// detalle (mark_corrections_seen), no solo por haber cargado el panel.
export function ResolvedCorrectionsBanner({
  corrections,
}: {
  corrections: ResolvedCorrection[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (corrections.length === 0) return null;

  function handleToggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !isPending) {
      startTransition(() => {
        markCorrectionsSeen();
      });
    }
  }

  return (
    <Card className="border-accent/50 bg-accent/5">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          Tienes {corrections.length}{" "}
          {corrections.length === 1 ? "corrección resuelta" : "correcciones resueltas"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <CardContent className="space-y-3 pt-0">
          {corrections.map((c) => (
            <div key={c.id} className="rounded-md border bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {c.clientNombre} · {c.activityNombre}
                </span>
                <Badge variant={c.estado === "aprobada" ? "success" : "destructive"}>
                  {c.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">
                {c.estado === "aprobada"
                  ? `Hora corregida a las ${formatDateTime(c.nueva_hora_fin_sugerida)}.`
                  : "Tu solicitud fue rechazada."}
                {c.estado === "rechazada" && c.nota_revision && (
                  <> Motivo: {c.nota_revision}</>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Revisada el {formatDateTime(c.fecha_revision)}
              </p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
