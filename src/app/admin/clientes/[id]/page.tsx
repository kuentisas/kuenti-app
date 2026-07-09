import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientFormDialog } from "../client-form-dialog";
import { ActivoSwitch } from "../activo-switch";
import { ProcessManager } from "./process-manager";
import { AssignmentEditor } from "./assignment-editor";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, nit, tarifa_mensual, activo")
    .eq("id", params.id)
    .single();

  if (!client) notFound();

  const [{ data: processes }, { data: assignments }, { data: colaboradoras }] =
    await Promise.all([
      supabase
        .from("processes")
        .select("id, nombre, activo")
        .eq("client_id", params.id)
        .order("nombre"),
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
          <ClientFormDialog mode="edit" client={client} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procesos</CardTitle>
          </CardHeader>
          <CardContent>
            <ProcessManager clientId={client.id} processes={processes ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colaboradoras asignadas</CardTitle>
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
    </div>
  );
}
