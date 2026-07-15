// El servidor (Vercel) corre en UTC, pero la firma opera en Bogotá
// (America/Bogota, UTC-5 fijo — Colombia no tiene horario de verano). Sin
// estos helpers, "hoy" y "este mes" se calculaban con la hora del
// servidor: pasadas las 7pm hora Colombia, el servidor ya cree que es el
// día siguiente, y las entradas de la mañana quedan "fuera de hoy".
export const BOGOTA_TZ = "America/Bogota";
const BOGOTA_OFFSET = "-05:00";

function toBogotaDateKey(date: Date): string {
  // en-CA formatea como YYYY-MM-DD, exactamente lo que necesitamos.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "YYYY-MM-DD" en hora de Bogotá para la fecha/hora dada — sirve como
// clave para agrupar time_entries por día (calendario, reportes).
export function bogotaDateKey(input: Date | string): string {
  return toBogotaDateKey(typeof input === "string" ? new Date(input) : input);
}

// "YYYY-MM" en hora de Bogotá.
export function bogotaMonthKey(input: Date | string = new Date()): string {
  return bogotaDateKey(input).slice(0, 7);
}

// Instante UTC que corresponde a la medianoche de Bogotá del día de
// `date` (por defecto, ahora). Útil para filtros "gte start_time" de hoy.
export function startOfBogotaDay(date: Date = new Date()): Date {
  return new Date(`${toBogotaDateKey(date)}T00:00:00${BOGOTA_OFFSET}`);
}

// Instante UTC que corresponde a la medianoche de Bogotá del primer día
// del mes de `monthKey` ("YYYY-MM") o, si no se pasa, el mes actual.
export function startOfBogotaMonth(monthKey?: string): Date {
  const key = monthKey ?? bogotaMonthKey();
  return new Date(`${key}-01T00:00:00${BOGOTA_OFFSET}`);
}

// Último instante (23:59:59.999 hora Bogotá) del mismo mes que
// startOfBogotaMonth.
export function endOfBogotaMonth(monthKey?: string): Date {
  const start = startOfBogotaMonth(monthKey);
  const nextMonthStart = new Date(start);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  return new Date(nextMonthStart.getTime() - 1);
}
