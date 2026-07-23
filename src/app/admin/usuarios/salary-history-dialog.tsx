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
import {
  HistorialVigenciaTable,
  type HistorialVigenciaRow,
} from "@/components/historial-vigencia-table";
import { formatCOP } from "@/lib/format";
import { bogotaMonthKey } from "@/lib/dates";
import { correctUserSalarioHistorico } from "./actions";

// Visor de historial + (admin-only) corrección retroactiva, combinados
// en un solo diálogo por espacio: la fila de la tabla de equipo ya tiene
// varias acciones, así que en vez de un botón más se anida la corrección
// adentro del mismo diálogo del historial, oculta hasta que se pide.
export function SalaryHistoryDialog({
  userId,
  nombre,
  historial,
  isAdmin,
}: {
  userId: string;
  nombre: string;
  historial: HistorialVigenciaRow[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const mesActual = bogotaMonthKey();

  function handleCorrect(formData: FormData) {
    const mesKey = String(formData.get("mes") ?? "");
    const salario = Number(formData.get("salario"));
    startTransition(async () => {
      const result = await correctUserSalarioHistorico(userId, salario, mesKey);
      if (result.error) {
        toast({ variant: "destructive", title: "No se pudo corregir", description: result.error });
        return;
      }
      toast({ title: "Historial corregido" });
      setShowCorrection(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver historial de salario">
          <History className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historial de salario — {nombre}</DialogTitle>
          <DialogDescription>
            Qué salario aplicó cada mes para el cálculo de rentabilidad.
          </DialogDescription>
        </DialogHeader>

        <HistorialVigenciaTable
          historial={historial}
          formatValor={formatCOP}
          emptyLabel="Sin salario configurado todavía."
        />

        {isAdmin && (
          <div className="space-y-3 border-t pt-4">
            {showCorrection ? (
              <form action={handleCorrect} className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Úsalo solo cuando el valor de un mes anterior estaba mal desde el principio —
                  no para subir el salario hacia adelante (para eso, usa la edición normal).
                  Corregir un mes también corrige los meses posteriores que no hayan tenido su
                  propio cambio, hasta el próximo cambio real.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mes">Mes a corregir</Label>
                    <Input id="mes" name="mes" type="month" max={mesActual} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="salario">Salario correcto (COP)</Label>
                    <Input id="salario" name="salario" type="number" min="0" step="1000" required />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-start">
                  <Button type="submit" size="sm" disabled={isPending} className="gap-2">
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Corregir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCorrection(false)}
                  >
                    Cancelar
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowCorrection(true)}>
                Corregir un mes pasado
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
