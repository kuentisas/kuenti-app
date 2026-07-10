"use client";

import { useState, useTransition } from "react";
import { Loader2, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { suggestActivity } from "./actions";

export function SuggestActivityDialog({
  clients,
}: {
  clients: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    const nombre = String(formData.get("nombre") ?? "");
    const motivo = String(formData.get("motivo") ?? "");
    startTransition(async () => {
      const result = await suggestActivity(clientId, nombre, motivo);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({
        title: "Actividad sugerida",
        description: "Queda pendiente de aprobación del administrador.",
      });
      setOpen(false);
    });
  }

  if (clients.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Sugerir actividad eventual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sugerir actividad eventual</DialogTitle>
          <DialogDescription>
            Queda pendiente hasta que un administrador la apruebe. Solo aplica al mes actual.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre de la actividad</Label>
            <Input id="nombre" name="nombre" required placeholder="Ej. Auditoría especial" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              name="motivo"
              required
              placeholder="¿Por qué es necesaria esta actividad?"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar sugerencia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
