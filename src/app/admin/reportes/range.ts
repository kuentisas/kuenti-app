import { bogotaDateKey, bogotaMonthKey } from "@/lib/dates";

// Compartido entre la página y la ruta de exportación para que ambas
// resuelvan el mismo rango por defecto cuando no vienen from/to en la URL
// — si divergieran, el Excel podría no coincidir con lo que se ve en pantalla.
export function resolveReportRange(params: { from?: string; to?: string }) {
  const fromStr = params.from ?? `${bogotaMonthKey()}-01`;
  const toStr = params.to ?? bogotaDateKey(new Date());

  const fromDate = new Date(`${fromStr}T00:00:00-05:00`);
  const toDate = new Date(`${toStr}T23:59:59.999-05:00`);

  return { fromStr, toStr, fromDate, toDate };
}
