"use client";

import { useState, useTransition } from "react";
import { Loader2, ArrowRightLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { reassignClients } from "./actions";

export function ReassignDialog({
  fromUserId,
  fromUserNombre,
  clients,
  otherColaboradoras,
}: {
  fromUserId: string;
  fromUserNombre: string;
  clients: { id: string; nombre: string }[];
  otherColaboradoras: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState<string>("");
  // Todos marcados por defecto — "seleccionar todos" es la conveniencia,
  // desmarcar individualmente es la excepción.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(clients.map((c) => c.id))
  );
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const allSelected = clients.length > 0 && selectedIds.size === clients.length;

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(clients.map((c) => c.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function resetAndClose() {
    setOpen(false);
    setToUserId("");
    setSelectedIds(new Set(clients.map((c) => c.id)));
  }

  function handleConfirm() {
    if (!toUserId || selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await reassignClients(fromUserId, toUserId, Array.from(selectedIds));
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({
        title: "Clientes reasignados",
        description: `${result.count} cliente(s) de ${fromUserNombre} fueron reasignados.`,
      });
      resetAndClose();
    });
  }

  if (clients.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Reasignar clientes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reasignar clientes de {fromUserNombre}</DialogTitle>
          <DialogDescription>
            Elegí cuáles clientes de {fromUserNombre} pasan a otro miembro del equipo. Están
            todos marcados por defecto — desmarcá los que no quieras mover.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reasignar a</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un miembro del equipo" />
              </SelectTrigger>
              <SelectContent>
                {otherColaboradoras.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 border-b pb-2">
              <Checkbox
                id="reassign-all"
                checked={allSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
              <Label htmlFor="reassign-all" className="text-sm font-medium">
                Seleccionar todos ({selectedIds.size}/{clients.length})
              </Label>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={`reassign-client-${c.id}`}
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={(checked) => toggleOne(c.id, checked === true)}
                  />
                  <Label htmlFor={`reassign-client-${c.id}`} className="text-sm font-normal">
                    {c.nombre}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !toUserId || selectedIds.size === 0}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar reasignación ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
