"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { createProcess, deleteProcess, toggleProcessActivo, updateProcess } from "./actions";

interface ActivityItem {
  id: string;
  nombre: string;
  activo: boolean;
}

function EditProcessDialog({
  clientId,
  process,
}: {
  clientId: string;
  process: ActivityItem;
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
          <DialogTitle>Editar actividad</DialogTitle>
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

function DeleteProcessDialog({
  clientId,
  process,
}: {
  clientId: string;
  process: ActivityItem;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProcess(process.id, clientId);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      if (result.mode === "soft") {
        toast({
          title: "Actividad desactivada",
          description:
            "Ya tiene horas registradas, así que no se puede eliminar por completo; se desactivó para conservar el historial.",
        });
      } else {
        toast({ title: "Actividad eliminada" });
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar "{process.nombre}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Si nunca registró horas, se elimina por completo. Si ya tiene horas
            registradas, no se puede eliminar sin perder ese historial — en ese caso se
            desactiva en su lugar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ProcessManager({
  clientId,
  activities,
}: {
  clientId: string;
  activities: ActivityItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const nombres = newName
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (nombres.length === 0) return;
    startTransition(async () => {
      const result = await createProcess(clientId, nombres);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({
        title: nombres.length > 1 ? `${nombres.length} actividades agregadas` : "Actividad agregada",
      });
      setNewName("");
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la actividad"
        />
        <Button type="submit" disabled={isPending} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Puedes agregar varias actividades a la vez separándolas por comas, por ejemplo:{" "}
        <span className="font-medium">Nómina, IVA, Contabilidad</span>.
      </p>

      <div className="divide-y rounded-md border">
        {activities.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            Este cliente no tiene actividades aún.
          </p>
        )}
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">{activity.nombre}</span>
            <div className="flex items-center gap-3">
              <Switch
                checked={activity.activo}
                onCheckedChange={(checked) => {
                  startTransition(async () => {
                    const result = await toggleProcessActivo(activity.id, clientId, checked);
                    if (result.error) {
                      toast({ variant: "destructive", title: "Error", description: result.error });
                    }
                  });
                }}
              />
              <EditProcessDialog clientId={clientId} process={activity} />
              <DeleteProcessDialog clientId={clientId} process={activity} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
