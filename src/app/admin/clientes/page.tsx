import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP } from "@/lib/format";
import { ClientFormDialog } from "./client-form-dialog";
import { ActivoSwitch } from "./activo-switch";

export default async function ClientesPage() {
  const supabase = createClient();
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, nombre, nit, activo, client_rates(tarifa_mensual)")
    .order("nombre");

  const clients = (clientsRaw ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    nit: c.nit,
    activo: c.activo,
    tarifa_mensual: (c.client_rates as unknown as { tarifa_mensual: number | null } | null)
      ?.tarifa_mensual ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-kuenti-slate">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los clientes de la firma, su tarifa mensual y sus procesos.
          </p>
        </div>
        <ClientFormDialog mode="create" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead className="text-right">Tarifa mensual</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Editar</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clients ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aún no hay clientes. Crea el primero.
                  </TableCell>
                </TableRow>
              )}
              {(clients ?? []).map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{client.nit ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {client.tarifa_mensual > 0 ? formatCOP(client.tarifa_mensual) : "—"}
                  </TableCell>
                  <TableCell>
                    <ActivoSwitch clientId={client.id} activo={client.activo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ClientFormDialog mode="edit" client={client} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/clientes/${client.id}`}
                      className="inline-flex items-center gap-1 text-sm text-kuenti-slate hover:underline"
                    >
                      Ver <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
