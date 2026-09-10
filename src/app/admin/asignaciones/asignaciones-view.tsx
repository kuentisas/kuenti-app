"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { unassignAllClients } from "./actions";

interface ClientRow {
  id: string;
  nombre: string;
  activo: boolean;
  colaboradoras: { id: string; nombre: string }[];
}

interface ColaboradoraRow {
  id: string;
  nombre: string;
  clients: { id: string; nombre: string }[];
}

export function AsignacionesView({
  clients,
  colaboradoras,
  isAdmin,
  totalAssignments,
}: {
  clients: ClientRow[];
  colaboradoras: ColaboradoraRow[];
  isAdmin: boolean;
  totalAssignments: number;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const assignedClientCount = clients.filter((c) => c.colaboradoras.length > 0).length;
  const unassignedClientCount = clients.length - assignedClientCount;

  function handleUnassignAll() {
    startTransition(async () => {
      const result = await unassignAllClients();
      if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
        return;
      }
      toast({
        title: "Asignaciones eliminadas",
        description: `Se quitaron ${result.count} asignaciones. Todos los clientes quedaron sin miembro del equipo asignado.`,
      });
      // revalidatePath invalida el cache, pero esta vista ya está montada en
      // el cliente — sin este refresh explícito, el admin vería la tabla
      // vieja (todo "asignado") hasta la próxima navegación manual, justo
      // después de una acción donde más importa confirmar visualmente que
      // sí surtió efecto.
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-kuenti-slate">Asignaciones</h1>
          <p className="text-sm text-muted-foreground">
            Quién tiene cada cliente, de un solo vistazo.
          </p>
        </div>

        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={totalAssignments === 0}
              >
                <UserX className="h-3.5 w-3.5" />
                Desasignar todos los clientes
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Desasignar todos los clientes?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto va a quitar las {totalAssignments} asignaciones actuales de{" "}
                  {assignedClientCount} cliente(s). Todos los clientes quedarán sin ningún
                  miembro del equipo asignado, listos para reasignar desde cero. El historial de
                  horas ya registrado no se ve afectado — esta acción solo toca las asignaciones,
                  nunca los tiempos ya cargados. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleUnassignAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sí, desasignar todos
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Tabs defaultValue="por-cliente">
        <TabsList>
          <TabsTrigger value="por-cliente">Por cliente</TabsTrigger>
          <TabsTrigger value="por-colaboradora">Por miembro del equipo</TabsTrigger>
        </TabsList>

        <TabsContent value="por-cliente">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Miembro(s) del equipo asignado(s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Aún no hay clientes.
                      </TableCell>
                    </TableRow>
                  )}
                  {clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.nombre}
                        {!c.activo && (
                          <span className="ml-2 text-xs text-muted-foreground">(inactivo)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.colaboradoras.length === 0 ? (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Sin asignar
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {c.colaboradoras.map((col) => (
                              <Badge key={col.id} variant="secondary">
                                {col.nombre}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {unassignedClientCount > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {unassignedClientCount} de {clients.length} clientes sin asignar.
            </p>
          )}
        </TabsContent>

        <TabsContent value="por-colaboradora">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro del equipo</TableHead>
                    <TableHead>Clientes asignados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradoras.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Aún no hay miembros del equipo activos.
                      </TableCell>
                    </TableRow>
                  )}
                  {colaboradoras.map((col) => (
                    <TableRow key={col.id}>
                      <TableCell className="font-medium">{col.nombre}</TableCell>
                      <TableCell>
                        {col.clients.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            Sin clientes asignados
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {col.clients.map((cl) => (
                              <Badge key={cl.id} variant="secondary">
                                {cl.nombre}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
