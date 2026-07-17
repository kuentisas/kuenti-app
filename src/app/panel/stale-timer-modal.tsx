"use client";

import { useState, useTransition } from "react";
import { Clock3, Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { BOGOTA_TZ } from "@/lib/dates";
import { resolveStaleTimer } from "./actions";
import { AdjustTimeDialog } from "./adjust-time-dialog";
import type { ActiveEntry } from "./timer-panel";

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// Modal obligatorio: sin botón de cerrar (hideClose) y sin permitir
// descartarlo con Escape o clickeando afuera — el usuario no puede seguir
// usando el panel hasta resolver qué pasó con el timer huérfano.
export function StaleTimerModal({
  entry,
  elapsedSeconds,
  onResolved,
  onKeepRunning,
}: {
  entry: ActiveEntry;
  elapsedSeconds: number;
  onResolved: () => void;
  onKeepRunning: () => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMotivo, setAdjustMotivo] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSeguiTrabajando() {
    startTransition(async () => {
      const result = await resolveStaleTimer("seguido");
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      onResolved();
    });
  }

  return (
    <>
      <Dialog open>
        <DialogContent
          hideClose
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-warning-foreground" />
              Tienes un timer sin detener
            </DialogTitle>
            <DialogDescription>
              {entry.clientNombre} · {entry.activityNombre} — iniciado a las{" "}
              {new Date(entry.startTime).toLocaleTimeString("es-CO", {
                timeZone: BOGOTA_TZ,
                hour: "2-digit",
                minute: "2-digit",
              })}
              , lleva {formatHMS(elapsedSeconds)} activo. Antes de seguir, cuéntanos qué pasó.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              className="w-full justify-start gap-2 border-accent bg-accent/5 text-accent hover:bg-accent/10 hover:text-accent"
              variant="outline"
              disabled={isPending}
              onClick={onKeepRunning}
            >
              <Play className="h-4 w-4" />
              Sigo trabajando en esto ahora mismo (no detener)
            </Button>
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              disabled={isPending}
              onClick={handleSeguiTrabajando}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Seguí trabajando en esto todo este tiempo
            </Button>
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setAdjustMotivo(undefined);
                setAdjustOpen(true);
              }}
            >
              Se me olvidó detenerla, en realidad paré antes
            </Button>
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setAdjustMotivo("Problema técnico (PC dañado, etc.)");
                setAdjustOpen(true);
              }}
            >
              Tuve un problema técnico (PC dañado, etc.)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AdjustTimeDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        defaultMotivo={adjustMotivo}
        onResolved={() => {
          setAdjustOpen(false);
          onResolved();
        }}
      />
    </>
  );
}
