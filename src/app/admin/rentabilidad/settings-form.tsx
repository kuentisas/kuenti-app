"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { updateCostoHoraPromedio } from "./actions";

export function SettingsForm({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(String(initialValue));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateCostoHoraPromedio(Number(value));
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({ title: "Costo hora promedio actualizado" });
      router.refresh();
    });
  }

  return (
    <div className="max-w-xs space-y-1.5">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="costo_hora" className="text-xs text-muted-foreground">
            Costo hora promedio (COP)
          </Label>
          <Input
            id="costo_hora"
            type="number"
            min="0"
            step="1000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending} className="gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Este valor se usa únicamente como estimado para colaboradoras que aún no tienen un
        salario mensual cargado en Equipo. Si ya cargaste el salario de una colaboradora, sus
        cálculos de rentabilidad usan ese salario real y este campo no les aplica.
      </p>
    </div>
  );
}
