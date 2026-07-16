import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/current-user";
import { canViewFinance, isAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import { InviteDialog } from "./invite-dialog";
import { ReassignDialog } from "./reassign-dialog";
import { UserStatusActions } from "./user-status-actions";
import { SalaryDialog } from "./salary-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

export default async function UsuariosPage() {
  const profile = await getCurrentUserProfile();
  const canSeeSalario = canViewFinance(profile?.role ?? "colaboradora");
  const canDelete = isAdmin(profile?.role ?? "colaboradora");
  const callerRole = profile?.role ?? "colaboradora";

  const supabase = createClient();

  const [{ data: usersRaw }, { data: assignments }] = await Promise.all([
    supabase
      .from("users")
      .select("id, nombre, email, role, activo, deleted_at, user_salaries(salario_mensual)")
      .order("nombre"),
    supabase.from("client_assignments").select("user_id, client_id, clients(nombre)"),
  ]);

  const users = (usersRaw ?? []).map((u) => ({
    ...u,
    salario_mensual:
      (u.user_salaries as unknown as { salario_mensual: number | null } | null)
        ?.salario_mensual ?? null,
  }));

  const clientsByUser = new Map<string, { id: string; nombre: string }[]>();
  for (const a of assignments ?? []) {
    const list = clientsByUser.get(a.user_id) ?? [];
    list.push({
      id: a.client_id,
      nombre: (a.clients as unknown as { nombre: string } | null)?.nombre ?? "—",
    });
    clientsByUser.set(a.user_id, list);
  }

  const allColaboradoras = users.filter(
    (u) => u.role === "colaboradora" && u.activo && !u.deleted_at
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-kuenti-slate">Equipo</h1>
          <p className="text-sm text-muted-foreground">
            Agrega, desactiva, reactiva o elimina usuarios. El historial de horas se
            conserva siempre.
          </p>
        </div>
        <InviteDialog callerRole={callerRole} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                {canSeeSalario && <TableHead className="text-right">Salario</TableHead>}
                <TableHead className="text-right">Clientes asignados</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canSeeSalario ? 7 : 6}
                    className="text-center text-muted-foreground"
                  >
                    Aún no hay usuarios.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => {
                const userClients = clientsByUser.get(u.id) ?? [];
                const clientCount = userClients.length;
                const otherColaboradoras = allColaboradoras.filter((c) => c.id !== u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin"
                          ? "Admin"
                          : u.role === "supervisor"
                            ? "Supervisor"
                            : "Miembro"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.deleted_at ? (
                        <Badge variant="destructive">Eliminada</Badge>
                      ) : u.activo ? (
                        <Badge variant="success">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Inactiva</Badge>
                      )}
                    </TableCell>
                    {canSeeSalario && (
                      <TableCell className="text-right">
                        {u.role === "colaboradora" ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-mono text-sm">
                              {u.salario_mensual != null ? formatCOP(u.salario_mensual) : "—"}
                            </span>
                            {!u.deleted_at && (
                              <SalaryDialog
                                userId={u.id}
                                nombre={u.nombre}
                                currentSalary={u.salario_mensual}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {clientCount}
                        {u.role === "colaboradora" && !u.deleted_at && (
                          <ReassignDialog
                            fromUserId={u.id}
                            fromUserNombre={u.nombre}
                            clients={userClients}
                            otherColaboradoras={otherColaboradoras}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!u.deleted_at && (
                          <ResetPasswordDialog userId={u.id} nombre={u.nombre} />
                        )}
                        <UserStatusActions
                          userId={u.id}
                          nombre={u.nombre}
                          activo={u.activo}
                          deleted={!!u.deleted_at}
                          canDelete={canDelete}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
