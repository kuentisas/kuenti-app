import type { Role } from "@/types/database";

export type { Role };

// Única definición de qué puede hacer cada rol — evita repetir
// `role === "admin"` (u olvidar agregar "supervisor") suelto en cada
// componente o server action. "Operativo" = clientes, actividades,
// aprobaciones, asignaciones, equipo (sin salario ni eliminar). El
// supervisor es admin operativo sin visibilidad financiera.
export function isAdmin(role: Role): boolean {
  return role === "admin";
}

export function canManageOperations(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

// Tarifas, salarios, rentabilidad, costo y eficiencia — exclusivo admin.
// Coincide 1:1 con lo que ya protege la RLS de client_rates/user_salaries.
export function canViewFinance(role: Role): boolean {
  return role === "admin";
}
