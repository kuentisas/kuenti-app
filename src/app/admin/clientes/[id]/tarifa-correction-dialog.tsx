"use client";

import { useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { bogotaMonthKey } from "@/lib/dates";
import { correctClientTarifaHistorico } from "../actions";

// Acción separada y explícita a propósito (no un checkbox dentro del
// formulario normal de edición): corregir el historial reescribe lo que
// ya se calculó para meses pasados, así que nunca debe pasar sin una
// decisión deliberada. Solo se renderiza para admin (ver ClientDetailPage).
export function TarifaCorrectionDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const mesActual = bogotaMonthKey();

  function handleSubmit(formData: FormData) {
    const mesKey = String(formData.get("mes") ?? "");
    const tarifa = Number(formData.get("tarifa"));
    startTransition(async () => {
      const result = await correctClientTarifaHistorico(clientId, tarifa, mesKey);
      if (result.error) {
        toast({ variant: "destructive", title: "No se pudo corregir", description: result.error });
        return;
      }
      toast({ title: "Historial corregido" });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-3.5 w-3.5" />
          Corregir historial
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corregir tarifa de un mes ya pasado</DialogTitle>
          <DialogDescription>
            Úsalo solo cuando el valor de un mes anterior estaba mal desde el principio — no
            para subir la tarifa hacia adelante (para eso, edita la tarifa normalmente). Corregir
            un mes también corrige los meses posteriores que no hayan tenido su propio cambio,
            hasta el próximo cambio real.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mes">Mes a corregir</Label>
            <Input id="mes" name="mes" type="month" max={mesActual} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tarifa">Tarifa correcta (COP)</Label>
            <Input id="tarifa" name="tarifa" type="number" min="0" step="1" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Corregir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
