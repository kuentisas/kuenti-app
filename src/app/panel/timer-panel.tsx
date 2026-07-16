"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Play, Square, Clock3, Loader2, WifiOff, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { SuggestActivityDialog } from "./suggest-activity-dialog";
import { RequestCorrectionDialog } from "./request-correction-dialog";
import { AdjustTimeDialog } from "./adjust-time-dialog";
import { StaleTimerModal } from "./stale-timer-modal";

const DOS_HORAS_SEGUNDOS = 2 * 3600;

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
  initialIsStale = false,
}: {
  clients: AssignedClient[];
  activeEntry: ActiveEntry | null;
  todayEntries: TodayEntry[];
  initialIsStale?: boolean;
}) {
  const [activeEntry, setActiveEntry] = useState(initialActiveEntry);
  const [elapsed, setElapsed] = useState(0);
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);
  const [snoozedUntilSeconds, setSnoozedUntilSeconds] = useState(DOS_HORAS_SEGUNDOS);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [staleUnresolved, setStaleUnresolved] = useState(initialIsStale);
  // Acordeón colapsado por defecto (25+ clientes reales no caben todos
  // expandidos en pantalla) — salvo el cliente con el timer activo, que
  // se auto-expande para que no haya que buscarlo.
  const [openClientIds, setOpenClientIds] = useState<string[]>(
    initialActiveEntry ? [initialActiveEntry.clientId] : []
  );
  const { toast } = useToast();

  useEffect(() => {
    setActiveEntry(initialActiveEntry);
    setSnoozedUntilSeconds(DOS_HORAS_SEGUNDOS);
  }, [initialActiveEntry]);

  useEffect(() => {
    if (activeEntry) {
      setOpenClientIds((prev) =>
        prev.includes(activeEntry.clientId) ? prev : [...prev, activeEntry.clientId]
      );
    }
  }, [activeEntry]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

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
      setSnoozedUntilSeconds(DOS_HORAS_SEGUNDOS);
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
      setSnoozedUntilSeconds(DOS_HORAS_SEGUNDOS);
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-md border border-warning bg-warning/10 px-4 py-2.5 text-sm text-warning-foreground">
          <WifiOff className="h-4 w-4 shrink-0" />
          Sin conexión — tu tiempo se sigue contando localmente. Iniciar y detener actividades
          vuelve a estar disponible al reconectar.
        </div>
      )}

      {activeEntry && staleUnresolved && (
        <StaleTimerModal
          entry={activeEntry}
          elapsedSeconds={elapsed}
          onResolved={() => {
            setStaleUnresolved(false);
            setActiveEntry(null);
          }}
          onKeepRunning={() => {
            // No se llama a ningún RPC: el timer sigue exactamente igual,
            // solo se descarta el modal. Si sigue activo pasados otros 5
            // minutos y la colaboradora recarga de nuevo, volverá a
            // aparecer — es el comportamiento esperado.
            setStaleUnresolved(false);
          }}
        />
      )}

      {activeEntry && !staleUnresolved && elapsed >= snoozedUntilSeconds && (
        <div className="flex flex-col gap-3 rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm text-warning-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            ¿Sigues en {activeEntry.activityNombre}? Llevas {formatHMS(elapsed)} activo.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSnoozedUntilSeconds((s) => s + 3600)}
            >
              Sí, continuar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdjustDialogOpen(true)}>
              Ajustar hora real
            </Button>
            <Button size="sm" variant="destructive" onClick={handleStop} disabled={isPending}>
              Detener ahora
            </Button>
          </div>
        </div>
      )}

      <AdjustTimeDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        onResolved={() => {
          setAdjustDialogOpen(false);
          setActiveEntry(null);
        }}
      />
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
                disabled={isPending || !isOnline || staleUnresolved}
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-kuenti-slate">Mis clientes</h2>
          <SuggestActivityDialog clients={clients.map((c) => ({ id: c.id, nombre: c.nombre }))} />
        </div>
        {clients.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no tienes clientes asignados. Contacta a tu administrador.
          </p>
        )}
        <Accordion
          type="multiple"
          value={openClientIds}
          onValueChange={setOpenClientIds}
          className="space-y-3"
        >
          {clients.map((client) => {
            const hasActiveTimer = activeEntry?.clientId === client.id;
            return (
              <AccordionItem
                key={client.id}
                value={client.id}
                className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
              >
                <AccordionTrigger className="border-b bg-secondary/30 px-6 py-3">
                  <span className="flex items-center gap-2 text-lg text-kuenti-slate">
                    {client.nombre}
                    {hasActiveTimer && (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 px-6 pb-6 pt-2">
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
                            disabled={isPending || !isOnline || staleUnresolved}
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
                            disabled={isPending || !isOnline || staleUnresolved}
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
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
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
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                    <TableCell>
                      {entry.endTime && (
                        <RequestCorrectionDialog
                          timeEntryId={entry.id}
                          currentEndTime={entry.endTime}
                        />
                      )}
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
