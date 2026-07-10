"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Play, Square, Clock3, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatDurationShort } from "@/lib/format";
import { startActivity, stopActivity } from "./actions";

export interface AssignedClient {
  id: string;
  nombre: string;
  activities: { id: string; nombre: string; activo: boolean }[];
}

export interface ActiveEntry {
  id: string;
  clientId: string;
  activityId: string;
  startTime: string;
  clientNombre: string;
  activityNombre: string;
}

export interface TodayEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  clientNombre: string;
  activityNombre: string;
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TimerPanel({
  clients,
  activeEntry: initialActiveEntry,
  todayEntries,
}: {
  clients: AssignedClient[];
  activeEntry: ActiveEntry | null;
  todayEntries: TodayEntry[];
}) {
  const [activeEntry, setActiveEntry] = useState(initialActiveEntry);
  const [elapsed, setElapsed] = useState(0);
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setActiveEntry(initialActiveEntry);
  }, [initialActiveEntry]);

  useEffect(() => {
    if (!activeEntry) {
      setElapsed(0);
      return;
    }
    const startMs = new Date(activeEntry.startTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const totalTodaySeconds = useMemo(() => {
    return todayEntries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0);
  }, [todayEntries]);

  function handleStart(clientId: string, clientNombre: string, activityId: string, activityNombre: string) {
    setPendingActivityId(activityId);
    startTransition(async () => {
      const result = await startActivity(clientId, activityId);
      setPendingActivityId(null);
      if (result.error) {
        toast({ variant: "destructive", title: "No se pudo iniciar", description: result.error });
        return;
      }
      if (result.autoStopped) {
        toast({
          title: "Se detuvo tu actividad anterior",
          description: `${result.autoStopped.activity_nombre} · ${result.autoStopped.client_nombre} (${formatDurationShort(result.autoStopped.duration_seconds)})`,
        });
      }
      setActiveEntry({
        id: "optimistic",
        clientId,
        activityId,
        startTime: new Date().toISOString(),
        clientNombre,
        activityNombre,
      });
    });
  }

  function handleStop() {
    setPendingActivityId(activeEntry?.activityId ?? null);
    startTransition(async () => {
      const result = await stopActivity();
      setPendingActivityId(null);
      if (result.error) {
        toast({ variant: "destructive", title: "No se pudo detener", description: result.error });
        return;
      }
      setActiveEntry(null);
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card
        className={cn(
          "sticky top-0 z-10 border-2",
          activeEntry ? "border-accent bg-accent/5" : "border-border"
        )}
      >
        <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
          {activeEntry ? (
            <>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Clock3 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {activeEntry.clientNombre} · {activeEntry.activityNombre}
                  </p>
                  <p className="font-mono text-3xl font-semibold tabular-nums text-kuenti-slate">
                    {formatHMS(elapsed)}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleStop}
                disabled={isPending}
                className="gap-2"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Detener
              </Button>
            </>
          ) : (
            <p className="text-center text-muted-foreground">
              No tienes ningún timer activo. Inicia uno desde la lista de abajo.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-kuenti-slate">Mis clientes</h2>
        {clients.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no tienes clientes asignados. Contacta a tu administrador.
          </p>
        )}
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{client.nombre}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.activities.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Este cliente no tiene actividades configuradas.
                </p>
              )}
              {client.activities.map((activity) => {
                const isActiveActivity = activeEntry?.activityId === activity.id;
                const isLoadingThis = isPending && pendingActivityId === activity.id;
                return (
                  <div
                    key={activity.id}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-4 py-3",
                      isActiveActivity && "border-accent bg-accent/5"
                    )}
                  >
                    <span className="text-sm font-medium">{activity.nombre}</span>
                    {isActiveActivity ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleStop}
                        disabled={isPending}
                        className="gap-1.5"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Square className="h-3.5 w-3.5" />
                        )}
                        Detener
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStart(client.id, client.nombre, activity.id, activity.nombre)
                        }
                        disabled={isPending}
                        className="gap-1.5"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Iniciar
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-kuenti-slate">Historial de hoy</h2>
          <span className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{formatHMS(totalTodaySeconds)}</span>
          </span>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Actividad</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin registros hoy.
                    </TableCell>
                  </TableRow>
                )}
                {todayEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.clientNombre}</TableCell>
                    <TableCell>{entry.activityNombre}</TableCell>
                    <TableCell>{formatClock(entry.startTime)}</TableCell>
                    <TableCell>
                      {entry.endTime ? formatClock(entry.endTime) : "En curso"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.durationSeconds != null
                        ? formatHMS(entry.durationSeconds)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
