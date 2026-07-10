"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDurationShort } from "@/lib/format";

export interface CalendarSession {
  id: string;
  clientNombre: string;
  activityNombre: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

// Grilla mensual simple: 7 columnas (lunes a domingo), sin librería de
// calendario — solo lo necesario para mostrar horas por día y expandir el
// detalle al hacer click.
export function MonthCalendar({
  year,
  month, // 1-12
  sessionsByDay,
}: {
  year: number;
  month: number;
  sessionsByDay: Map<string, CalendarSession[]>;
}) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay(): 0=domingo..6=sábado. Convertimos a offset lunes=0..domingo=6.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;

  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <div className="grid grid-cols-7 border-b bg-secondary/50 text-xs font-medium text-muted-foreground">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="min-h-20 border-b border-r bg-secondary/20" />;
          }
          const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const sessions = sessionsByDay.get(dateKey) ?? [];
          const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);

          const cellContent = (
            <div
              className={cn(
                "flex min-h-20 flex-col gap-1 border-b border-r p-2 text-left transition-colors",
                sessions.length > 0 ? "cursor-pointer hover:bg-accent/5" : "cursor-default",
                isToday(day) && "bg-accent/10"
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  isToday(day) ? "text-accent" : "text-muted-foreground"
                )}
              >
                {day}
              </span>
              {totalSeconds > 0 && (
                <span className="font-mono text-sm font-semibold text-kuenti-slate">
                  {formatDurationShort(totalSeconds)}
                </span>
              )}
            </div>
          );

          if (sessions.length === 0) {
            return <div key={dateKey}>{cellContent}</div>;
          }

          return (
            <Popover key={dateKey}>
              <PopoverTrigger asChild>
                <button type="button" className="text-left">
                  {cellContent}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <p className="mb-2 text-sm font-semibold text-kuenti-slate">
                  {new Date(year, month - 1, day).toLocaleDateString("es-CO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className="rounded-md border px-3 py-2 text-sm">
                      <p className="font-medium">{s.clientNombre}</p>
                      <p className="text-muted-foreground">{s.activityNombre}</p>
                      <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {formatClock(s.startTime)} –{" "}
                          {s.endTime ? formatClock(s.endTime) : "en curso"}
                        </span>
                        <span className="font-mono">{formatDurationShort(s.durationSeconds)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
