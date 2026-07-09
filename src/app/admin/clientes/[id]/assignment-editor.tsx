"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { setClientAssignments } from "./actions";

interface ColaboradoraOption {
  id: string;
  nombre: string;
  activo: boolean;
}

export function AssignmentEditor({
  clientId,
  colaboradoras,
  initialSelectedIds,
}: {
  clientId: string;
  colaboradoras: ColaboradoraOption[];
  initialSelectedIds: string[];
}) {
  const [selected, setSelected] = useState(new Set(initialSelectedIds));
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setClientAssignments(clientId, Array.from(selected));
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({ title: "Asignaciones actualizadas" });
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-md border p-3">
        {colaboradoras.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay colaboradoras registradas todavía.
          </p>
        )}
        {colaboradoras.map((colaboradora) => (
          <div key={colaboradora.id} className="flex items-center gap-3">
            <Checkbox
              id={`colab-${colaboradora.id}`}
              checked={selected.has(colaboradora.id)}
              onCheckedChange={() => toggle(colaboradora.id)}
            />
            <Label
              htmlFor={`colab-${colaboradora.id}`}
              className={colaboradora.activo ? "" : "text-muted-foreground line-through"}
            >
              {colaboradora.nombre}
              {!colaboradora.activo && " (inactiva)"}
            </Label>
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={isPending} className="gap-2">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar asignaciones
      </Button>
    </div>
  );
}
