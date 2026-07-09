"use client";

import { useState, useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { inviteUser } from "./actions";

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("colaboradora");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    formData.set("role", role);
    startTransition(async () => {
      const result = await inviteUser(formData);
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({ title: "Invitación enviada", description: "Le llegará un correo para crear su contraseña." });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invitar miembro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar nuevo usuario</DialogTitle>
          <DialogDescription>
            Le llegará un correo de invitación para configurar su contraseña.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input id="nombre" name="nombre" required placeholder="María Pérez" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required placeholder="maria@kuenti.co" />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaboradora">Miembro del equipo</SelectItem>
                <SelectItem value="admin">Admin (gerente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar invitación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
