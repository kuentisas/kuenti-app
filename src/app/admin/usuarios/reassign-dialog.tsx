"use client";

import { useState, useTransition } from "react";
import { Loader2, ArrowRightLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { reassignAllClients } from "./actions";

export function ReassignDialog({
  fromUserId,
  fromUserNombre,
  clientCount,
  otherColaboradoras,
}: {
  fromUserId: string;
  fromUserNombre: string;
  clientCount: number;
  otherColaboradoras: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleConfirm() {
    if (!toUserId) return;
    startTransition(async () => {
      const result = await reassignAllClients(fromUserId, toUserId);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({
        title: "Clientes reasignados",
        description: `${result.count} cliente(s) de ${fromUserNombre} fueron reasignados.`,
      });
      setOpen(false);
      setToUserId("");
    });
  }

  if (clientCount === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Los {clientCount} cliente(s) asignados a {fromUserNombre} pasarán, en un solo
            paso, a la colaboradora que elijas. Útil si se incapacita o deja el equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Reasignar a</Label>
          <Select value={toUserId} onValueChange={setToUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una colaboradora" />
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
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={isPending || !toUserId} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar reasignación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
