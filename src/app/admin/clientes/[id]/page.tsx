import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/current-user";
import { canViewFinance } from "@/lib/roles";
import { bogotaMonthKey } from "@/lib/dates";
import { estaVigente, formatMesVigencia } from "@/lib/vigencia";
import { formatCOP } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientFormDialog } from "../client-form-dialog";
import { ActivoSwitch } from "../activo-switch";
import { ProcessManager } from "./process-manager";
import { AssignmentEditor } from "./assignment-editor";
import { HistorialVigenciaTable } from "@/components/historial-vigencia-table";
import { TarifaCorrectionDialog } from "./tarifa-correction-dialog";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getCurrentUserProfile();
  const canSeeTarifa = canViewFinance(profile?.role ?? "colaboradora");
  const isAdminReal = profile?.role === "admin";

  const supabase = createClient();

  const [{ data: clientRaw }, { data: rateHistoryRaw }] = await Promise.all([
    supabase.from("clients").select("id, nombre, nit, activo").eq("id", params.id).single(),
    canSeeTarifa
      ? supabase
          .from("client_rate_history")
          .select("id, tarifa_mensual, vigente_desde, es_correccion")
          .eq("client_id", params.id)
          .order("vigente_desde", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  if (!clientRaw) notFound();

  const historial = rateHistoryRaw ?? [];
  const mesActualKey = bogotaMonthKey();
  const tarifaMasReciente = historial[0]; // ya viene ordenado desc por vigente_desde

  const client = {
    id: clientRaw.id,
    nombre: clientRaw.nombre,
    nit: clientRaw.nit,
    activo: clientRaw.activo,
    tarifa_mensual: tarifaMasReciente?.tarifa_mensual ?? 0,
  };
  const tarifaVigente = tarifaMasReciente
    ? estaVigente(tarifaMasReciente.vigente_desde, mesActualKey)
    : true;

  const [{ data: activities }, { data: assignments }, { data: colaboradoras }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("id, nombre, activo, orden")
        .eq("client_id", params.id)
        .order("orden"),
      supabase
        .from("client_assignments")
        .select("user_id")
        .eq("client_id", params.id),
      supabase
        .from("users")
        .select("id, nombre, activo")
        .eq("role", "colaboradora")
        .is("deleted_at", null)
        .order("nombre"),
    ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-kuenti-slate">{client.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {client.nit ? `NIT ${client.nit}` : "Sin NIT registrado"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Activo
            <ActivoSwitch clientId={client.id} activo={client.activo} />
          </div>
          <ClientFormDialog mode="edit" client={client} canEditTarifa={canSeeTarifa} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividades</CardTitle>
          </CardHeader>
          <CardContent>
            <ProcessManager clientId={client.id} activities={activities ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipo asignado</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignmentEditor
              clientId={client.id}
              colaboradoras={colaboradoras ?? []}
              initialSelectedIds={(assignments ?? []).map((a) => a.user_id)}
            />
          </CardContent>
        </Card>
      </div>

      {canSeeTarifa && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Tarifa mensual</CardTitle>
            {isAdminReal && <TarifaCorrectionDialog clientId={client.id} />}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="font-mono text-2xl font-semibold text-kuenti-slate">
              {client.tarifa_mensual > 0 ? formatCOP(client.tarifa_mensual) : "Sin tarifa configurada"}
              {!tarifaVigente && tarifaMasReciente && (
                <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                  (vigente desde {formatMesVigencia(tarifaMasReciente.vigente_desde)})
                </span>
              )}
            </div>
            <HistorialVigenciaTable
              historial={historial.map((h) => ({
                id: h.id,
                valor: h.tarifa_mensual,
                vigente_desde: h.vigente_desde,
                es_correccion: h.es_correccion,
              }))}
              formatValor={formatCOP}
              emptyLabel="Sin tarifa configurada todavía."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
