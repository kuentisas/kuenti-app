// Agregación pura (sin I/O) de time_entries -> colaboradora -> cliente ->
// actividad, compartida entre la página (acordeón "Por miembro del equipo")
// y la ruta de exportación a Excel, para no duplicar esta lógica ni
// arriesgar que diverjan entre pantalla y archivo descargado.

export interface TeamEntryRow {
  duration_seconds: number | null;
  start_time: string;
  clients: { id: string; nombre: string } | null;
  activities: { id: string; nombre: string } | null;
  users: {
    id: string;
    nombre: string;
    activo: boolean;
    deleted_at: string | null;
  } | null;
}

export interface ActivityBreakdown {
  id: string;
  nombre: string;
  seconds: number;
}

export interface ClientBreakdown {
  id: string;
  nombre: string;
  seconds: number;
  activities: ActivityBreakdown[];
}

export interface TeamMemberBreakdown {
  id: string;
  nombre: string;
  activo: boolean;
  deleted: boolean;
  seconds: number;
  clients: ClientBreakdown[];
}

export function buildTeamBreakdown(entries: TeamEntryRow[]): TeamMemberBreakdown[] {
  const byUser = new Map<
    string,
    {
      nombre: string;
      activo: boolean;
      deleted: boolean;
      seconds: number;
      clients: Map<string, { nombre: string; seconds: number; activities: Map<string, { nombre: string; seconds: number }> }>;
    }
  >();

  for (const e of entries) {
    if (!e.users) continue;
    const seconds = e.duration_seconds ?? 0;

    const user = byUser.get(e.users.id) ?? {
      nombre: e.users.nombre,
      activo: e.users.activo,
      deleted: !!e.users.deleted_at,
      seconds: 0,
      clients: new Map(),
    };
    user.seconds += seconds;

    if (e.clients) {
      const client = user.clients.get(e.clients.id) ?? {
        nombre: e.clients.nombre,
        seconds: 0,
        activities: new Map(),
      };
      client.seconds += seconds;

      if (e.activities) {
        const activity = client.activities.get(e.activities.id) ?? {
          nombre: e.activities.nombre,
          seconds: 0,
        };
        activity.seconds += seconds;
        client.activities.set(e.activities.id, activity);
      }

      user.clients.set(e.clients.id, client);
    }

    byUser.set(e.users.id, user);
  }

  return Array.from(byUser.entries())
    .map(([id, u]) => ({
      id,
      nombre: u.nombre,
      activo: u.activo,
      deleted: u.deleted,
      seconds: u.seconds,
      clients: Array.from(u.clients.entries())
        .map(([clientId, c]) => ({
          id: clientId,
          nombre: c.nombre,
          seconds: c.seconds,
          activities: Array.from(c.activities.entries())
            .map(([activityId, a]) => ({ id: activityId, nombre: a.nombre, seconds: a.seconds }))
            .sort((a, b) => b.seconds - a.seconds),
        }))
        .sort((a, b) => b.seconds - a.seconds),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}
