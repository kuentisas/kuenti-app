import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/current-user";
import { canViewFinance } from "@/lib/roles";
import { bogotaMonthKey } from "@/lib/dates";
import { masReciente, estaVigente, formatMesVigencia } from "@/lib/vigencia";
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
  const profile = await getCurrentUserProfile();
  const canSeeTarifa = canViewFinance(profile?.role ?? "colaboradora");

  const supabase = createClient();
  const [{ data: clientsRaw }, { data: rateHistoryRaw }] = await Promise.all([
    supabase.from("clients").select("id, nombre, nit, activo").order("nombre"),
    canSeeTarifa
      ? supabase.from("client_rate_history").select("client_id, tarifa_mensual, vigente_desde")
      : Promise.resolve({ data: [] }),
  ]);

  const mesActualKey = bogotaMonthKey();
  // El valor más reciente jamás fijado, aunque todavía no haya entrado en
  // vigencia (regla: un cambio normal aplica desde el mes siguiente) — se
  // aclara en la UI cuándo entra en vigor si todavía no aplica hoy.
  const tarifaPorCliente = masReciente(rateHistoryRaw ?? [], (r) => r.client_id);

  const clients = (clientsRaw ?? []).map((c) => {
    const tarifa = tarifaPorCliente.get(c.id);
    return {
      id: c.id,
      nombre: c.nombre,
      nit: c.nit,
      activo: c.activo,
      tarifa_mensual: tarifa?.tarifa_mensual ?? 0,
      tarifaVigente: tarifa ? estaVigente(tarifa.vigente_desde, mesActualKey) : true,
      tarifaVigenteDesde: tarifa?.vigente_desde ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-kuenti-slate">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los clientes de la firma, su tarifa mensual y sus procesos.
          </p>
        </div>
        <ClientFormDialog mode="create" canEditTarifa={canSeeTarifa} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>NIT</TableHead>
                {canSeeTarifa && <TableHead className="text-right">Tarifa mensual</TableHead>}
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Editar</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clients ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canSeeTarifa ? 6 : 5}
                    className="text-center text-muted-foreground"
                  >
                    Aún no hay clientes. Crea el primero.
                  </TableCell>
                </TableRow>
              )}
              {(clients ?? []).map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{client.nit ?? "—"}</TableCell>
                  {canSeeTarifa && (
                    <TableCell className="text-right font-mono">
                      {client.tarifa_mensual > 0 ? (
                        <>
                          {formatCOP(client.tarifa_mensual)}
                          {!client.tarifaVigente && client.tarifaVigenteDesde && (
                            <span className="ml-1 font-sans text-xs text-muted-foreground">
                              (vigente desde {formatMesVigencia(client.tarifaVigenteDesde)})
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <ActivoSwitch clientId={client.id} activo={client.activo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ClientFormDialog mode="edit" client={client} canEditTarifa={canSeeTarifa} />
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
