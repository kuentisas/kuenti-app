"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";

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
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { bogotaDatetimeLocal } from "@/lib/dates";
import { resolveStaleTimer } from "./actions";

export function AdjustTimeDialog({
  open,
  onOpenChange,
  defaultMotivo,
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMotivo?: string;
  onResolved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    const horaReal = String(formData.get("hora_real") ?? "");
    const nota = String(formData.get("nota") ?? "");
    startTransition(async () => {
      const result = await resolveStaleTimer("ajustado", horaReal, nota);
      if (result.error) {
        toast({ variant: "destructive", title: "No se pudo ajustar", description: result.error });
        return;
      }
      toast({ title: "Timer ajustado" });
      onResolved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar hora real</DialogTitle>
          <DialogDescription>¿A qué hora realmente detuviste esta actividad?</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hora_real">Hora de fin real</Label>
            <Input
              id="hora_real"
              name="hora_real"
              type="datetime-local"
              step="1"
              required
              defaultValue={bogotaDatetimeLocal()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nota">Motivo</Label>
            <Textarea
              id="nota"
              name="nota"
              required
              defaultValue={defaultMotivo}
              placeholder="¿Qué pasó?"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
