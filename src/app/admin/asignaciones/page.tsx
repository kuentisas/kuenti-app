import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/current-user";
import { AsignacionesView } from "./asignaciones-view";

export default async function AsignacionesPage() {
  const profile = await getCurrentUserProfile();
  const isAdminReal = profile?.role === "admin";

  const supabase = createClient();

  const [{ data: clientsRaw }, { data: assignmentsRaw }, { data: colaboradorasRaw }] =
    await Promise.all([
      supabase.from("clients").select("id, nombre, activo").order("nombre"),
      supabase
        .from("client_assignments")
        .select("client_id, user_id, clients(nombre), users(nombre)"),
      // Cualquier rol puede tener client_assignments — admin y supervisor
      // también operan como un miembro más, sin tratamiento especial.
      supabase
        .from("users")
        .select("id, nombre")
        .eq("activo", true)
        .is("deleted_at", null)
        .order("nombre"),
    ]);

  const assignments = (assignmentsRaw ?? []).map((a) => ({
    clientId: a.client_id,
    userId: a.user_id,
    clientNombre: (a.clients as unknown as { nombre: string } | null)?.nombre ?? "—",
    userNombre: (a.users as unknown as { nombre: string } | null)?.nombre ?? "—",
  }));

  const colaboradorasPorCliente = new Map<string, { id: string; nombre: string }[]>();
  const clientesPorColaboradora = new Map<string, { id: string; nombre: string }[]>();
  for (const a of assignments) {
    const clientList = colaboradorasPorCliente.get(a.clientId) ?? [];
    clientList.push({ id: a.userId, nombre: a.userNombre });
    colaboradorasPorCliente.set(a.clientId, clientList);

    const colabList = clientesPorColaboradora.get(a.userId) ?? [];
    colabList.push({ id: a.clientId, nombre: a.clientNombre });
    clientesPorColaboradora.set(a.userId, colabList);
  }

  const clients = (clientsRaw ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    activo: c.activo,
    colaboradoras: colaboradorasPorCliente.get(c.id) ?? [],
  }));

  const colaboradoras = (colaboradorasRaw ?? []).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    clients: clientesPorColaboradora.get(u.id) ?? [],
  }));

  return (
    <AsignacionesView
      clients={clients}
      colaboradoras={colaboradoras}
      isAdmin={isAdminReal}
      totalAssignments={assignments.length}
    />
  );
}
