"use client";

import { useTransition } from "react";
import { Loader2, UserX, UserCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { deactivateUser, deleteUser, reactivateUser } from "./actions";

export function UserStatusActions({
  userId,
  nombre,
  activo,
  deleted,
  canDelete = true,
}: {
  userId: string;
  nombre: string;
  activo: boolean;
  deleted: boolean;
  canDelete?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  if (deleted) {
    return <span className="text-sm text-muted-foreground">Sin acciones disponibles</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {activo ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <UserX className="h-3.5 w-3.5" />
              Desactivar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desactivar a {nombre}?</AlertDialogTitle>
              <AlertDialogDescription>
                No podrá iniciar sesión, pero su historial de horas registradas se
                conserva íntegramente para los reportes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(async () => {
                    const result = await deactivateUser(userId);
                    if (result.error) {
                      toast({ variant: "destructive", title: "Error", description: result.error });
                    } else {
                      toast({ title: "Usuario desactivado" });
                    }
                  })
                }
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await reactivateUser(userId);
              if (result.error) {
                toast({ variant: "destructive", title: "Error", description: result.error });
              } else {
                toast({ title: "Usuario reactivado" });
              }
            })
          }
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserCheck className="h-3.5 w-3.5" />
          )}
          Reactivar
        </Button>
      )}

      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar a {nombre}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se revocará su acceso por completo. Si ya tiene horas registradas, su
                historial se conserva para los reportes y solo se elimina su acceso; si
                nunca registró horas, su cuenta se borra por completo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteUser(userId);
                    if (result.error) {
                      toast({ variant: "destructive", title: "Error", description: result.error });
                    } else {
                      toast({ title: "Usuario eliminado" });
                    }
                  })
                }
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
