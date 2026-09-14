"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";

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
import type { Role } from "@/types/database";
import { updateTeamMemberProfile } from "./actions";

// canEditRole llega ya calculado desde page.tsx (callerRole === "admin" &&
// target.role !== "admin") — nunca supervisor, nunca para mover a/desde
// admin. `role` puede ser cualquiera de los 3 (incluido "admin", para las
// filas de otros admins que un admin también puede editar en nombre/correo)
// pero el selector de rol solo se renderiza cuando canEditRole es true, que
// ya excluye ese caso. El servidor revalida todo esto igual (ver
// updateTeamMemberProfile).
export function EditMemberDialog({
  userId,
  nombre,
  email,
  role,
  canEditRole,
}: {
  userId: string;
  nombre: string;
  email: string;
  role: Role;
  canEditRole: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [nuevoRol, setNuevoRol] = useState<"colaboradora" | "supervisor">(
    role === "admin" ? "colaboradora" : role
  );
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    const nuevoNombre = String(formData.get("nombre") ?? "");
    const nuevoEmail = String(formData.get("email") ?? "");
    startTransition(async () => {
      const result = await updateTeamMemberProfile(
        userId,
        nuevoNombre,
        nuevoEmail,
        canEditRole ? nuevoRol : undefined
      );
      if (result.error) {
        toast({ variant: "destructive", title: "No se pudo guardar", description: result.error });
        return;
      }
      toast({ title: "Perfil actualizado" });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar miembro">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar a {nombre}</DialogTitle>
          <DialogDescription>
            El correo es el usuario con el que inicia sesión — el cambio aplica de inmediato,
            sin correo de verificación.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit_nombre">Nombre</Label>
            <Input id="edit_nombre" name="nombre" required defaultValue={nombre} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit_email">Correo</Label>
            <Input id="edit_email" name="email" type="email" required defaultValue={email} />
          </div>
          {canEditRole && (
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={nuevoRol} onValueChange={(v) => setNuevoRol(v as typeof nuevoRol)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaboradora">Miembro del equipo</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
