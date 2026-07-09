"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { createProcess, toggleProcessActivo, updateProcess } from "./actions";

interface ProcessItem {
  id: string;
  nombre: string;
  activo: boolean;
}

function EditProcessDialog({
  clientId,
  process,
}: {
  clientId: string;
  process: ProcessItem;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateProcess(process.id, clientId, formData);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({ title: "Proceso actualizado" });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar proceso</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`nombre-${process.id}`}>Nombre</Label>
            <Input id={`nombre-${process.id}`} name="nombre" required defaultValue={process.nombre} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProcessManager({
  clientId,
  processes,
}: {
  clientId: string;
  processes: ProcessItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const formData = new FormData();
    formData.set("nombre", newName.trim());
    startTransition(async () => {
      const result = await createProcess(clientId, formData);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      setNewName("");
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre del proceso (ej. Nómina, IVA, Contabilidad)"
        />
        <Button type="submit" disabled={isPending} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </form>

      <div className="divide-y rounded-md border">
        {processes.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            Este cliente no tiene procesos aún.
          </p>
        )}
        {processes.map((process) => (
          <div key={process.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">{process.nombre}</span>
            <div className="flex items-center gap-3">
              <Switch
                checked={process.activo}
                onCheckedChange={(checked) => {
                  startTransition(async () => {
                    const result = await toggleProcessActivo(process.id, clientId, checked);
                    if (result.error) {
                      toast({ variant: "destructive", title: "Error", description: result.error });
                    }
                  });
                }}
              />
              <EditProcessDialog clientId={clientId} process={process} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
