"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { BOGOTA_TZ, bogotaDatetimeLocal, bogotaDatetimeLocalToISOString } from "@/lib/dates";
import { requestCorrection } from "./actions";

function formatHoraBogota(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: BOGOTA_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RequestCorrectionDialog({
  timeEntryId,
  currentStartTime,
  currentEndTime,
}: {
  timeEntryId: string;
  currentStartTime: string;
  currentEndTime: string;
}) {
  const [open, setOpen] = useState(false);
  const [corrigeInicio, setCorrigeInicio] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    const nuevaHoraFin = String(formData.get("nueva_hora_fin") ?? "");
    const nuevaHoraInicio = corrigeInicio
      ? String(formData.get("nueva_hora_inicio") ?? "")
      : "";
    const motivo = String(formData.get("motivo") ?? "");

    const nuevaHoraFinISO = nuevaHoraFin ? bogotaDatetimeLocalToISOString(nuevaHoraFin) : null;
    const nuevaHoraInicioISO = nuevaHoraInicio
      ? bogotaDatetimeLocalToISOString(nuevaHoraInicio)
      : null;
    const horaInicioEfectiva = nuevaHoraInicioISO ?? currentStartTime;

    if (nuevaHoraFinISO && nuevaHoraFinISO < horaInicioEfectiva) {
      toast({
        variant: "destructive",
        title: "Hora de fin inválida",
        description: corrigeInicio
          ? "La hora de fin no puede ser anterior a la hora de inicio que estás corrigiendo."
          : `La hora de fin no puede ser anterior a la hora de inicio del registro (${formatHoraBogota(currentStartTime)}). Si también necesitas corregir la hora de inicio, marca la casilla de abajo.`,
      });
      return;
    }

    startTransition(async () => {
      const result = await requestCorrection(
        timeEntryId,
        nuevaHoraFin,
        motivo,
        nuevaHoraInicio || null
      );
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({
        title: "Corrección solicitada",
        description: "Queda pendiente de revisión del administrador.",
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar corrección</DialogTitle>
          <DialogDescription>
            No modifica el registro todavía — queda pendiente hasta que un administrador la
            apruebe.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="corrige_inicio"
              checked={corrigeInicio}
              onCheckedChange={(checked) => setCorrigeInicio(checked === true)}
            />
            <Label htmlFor="corrige_inicio" className="font-normal">
              También corregir la hora de inicio
            </Label>
          </div>
          {corrigeInicio && (
            <div className="space-y-1.5">
              <Label htmlFor="nueva_hora_inicio">Hora de inicio correcta</Label>
              <Input
                id="nueva_hora_inicio"
                name="nueva_hora_inicio"
                type="datetime-local"
                step="1"
                required={corrigeInicio}
                defaultValue={bogotaDatetimeLocal(currentStartTime)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="nueva_hora_fin">Hora de fin correcta</Label>
            <Input
              id="nueva_hora_fin"
              name="nueva_hora_fin"
              type="datetime-local"
              step="1"
              required
              defaultValue={bogotaDatetimeLocal(currentEndTime)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              name="motivo"
              required
              placeholder="Ej. Me equivoqué de hora al detener el timer"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
