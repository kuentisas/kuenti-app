"use client";

import { useState } from "react";
import { ListTree, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDurationShort } from "@/lib/format";
import { RequestCorrectionDialog } from "../request-correction-dialog";

export interface SessionEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  ajustadoManualmente: boolean;
  notaAjuste: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export function ActivityDetailDialog({
  activityNombre,
  clientNombre,
  totalSeconds,
  sessions,
}: {
  activityNombre: string;
  clientNombre: string;
  totalSeconds: number;
  sessions: SessionEntry[];
}) {
  const [open, setOpen] = useState(false);
  // Más recientes primero.
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ListTree className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activityNombre}</DialogTitle>
          <DialogDescription>
            {clientNombre} — total del mes: {formatDurationShort(totalSeconds)}
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{formatDate(s.startTime)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatClock(s.startTime)} – {s.endTime ? formatClock(s.endTime) : "en curso"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatDurationShort(s.durationSeconds)}
                </TableCell>
                <TableCell>
                  {s.ajustadoManualmente ? (
                    s.notaAjuste ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="warning" className="cursor-default gap-1">
                            <Pencil className="h-3 w-3" />
                            Ajustado
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{s.notaAjuste}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <Pencil className="h-3 w-3" />
                        Ajustado
                      </Badge>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.endTime && (
                    <RequestCorrectionDialog timeEntryId={s.id} currentEndTime={s.endTime} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
