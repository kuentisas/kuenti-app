"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { createClientRecord, updateClientRecord } from "./actions";

interface ClientFormDialogProps {
  mode: "create" | "edit";
  client?: { id: string; nombre: string; nit: string | null; tarifa_mensual: number };
}

export function ClientFormDialog({ mode, client }: ClientFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClientRecord(formData)
          : await updateClientRecord(client!.id, formData);

      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }

      toast({
        title: mode === "create" ? "Cliente creado" : "Cliente actualizado",
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        ) : (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuevo cliente" : "Editar cliente"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              required
              defaultValue={client?.nombre}
              placeholder="Empresa S.A.S."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nit">NIT (opcional)</Label>
            <Input id="nit" name="nit" defaultValue={client?.nit ?? ""} placeholder="900.123.456-7" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tarifa_mensual">Tarifa mensual (COP, opcional)</Label>
            <Input
              id="tarifa_mensual"
              name="tarifa_mensual"
              type="number"
              min="0"
              step="1000"
              placeholder="Sin definir"
              defaultValue={client?.tarifa_mensual || undefined}
            />
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
