"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { requestCorrection } from "./actions";

// Incluye segundos: truncar a minutos podía dejar la hora "corregida" antes
// del start_time real en actividades cortas (menos de un minuto), lo que
// hacía fallar el chequeo "nueva_hora_fin_sugerida >= start_time" de RLS.
function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function RequestCorrectionDialog({
  timeEntryId,
  currentEndTime,
}: {
  timeEntryId: string;
  currentEndTime: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    const nuevaHoraFin = String(formData.get("nueva_hora_fin") ?? "");
    const motivo = String(formData.get("motivo") ?? "");
    startTransition(async () => {
      const result = await requestCorrection(timeEntryId, nuevaHoraFin, motivo);
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
          <div className="space-y-1.5">
            <Label htmlFor="nueva_hora_fin">Hora de fin correcta</Label>
            <Input
              id="nueva_hora_fin"
              name="nueva_hora_fin"
              type="datetime-local"
              step="1"
              required
              defaultValue={toDatetimeLocal(currentEndTime)}
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
