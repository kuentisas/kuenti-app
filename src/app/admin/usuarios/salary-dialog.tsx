"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";

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
import { updateUserSalary } from "./actions";

export function SalaryDialog({
  userId,
  nombre,
  currentSalary,
}: {
  userId: string;
  nombre: string;
  currentSalary: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    const salario = Number(formData.get("salario"));
    startTransition(async () => {
      const result = await updateUserSalary(userId, salario);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({ title: "Salario actualizado" });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salario de {nombre}</DialogTitle>
          <DialogDescription>
            Solo el admin puede ver o editar este dato — nunca es visible para el miembro del
            equipo, ni siquiera el propio (protegido por RLS a nivel de base de datos).
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="salario">Salario mensual (COP)</Label>
            <Input
              id="salario"
              name="salario"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={currentSalary ?? undefined}
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
