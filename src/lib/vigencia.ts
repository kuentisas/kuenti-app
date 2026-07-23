// Reducción de filas de historial (client_rate_history / user_salary_history)
// a "el valor que aplica", en sus dos sentidos distintos:
//   - vigenteEnMes: para cálculos de un mes específico (rentabilidad) — el
//     valor que realmente aplicaba ese mes, sin importar qué se haya
//     cambiado después.
//   - masReciente: para pantallas de "configuración actual" (listas de
//     clientes/equipo) — el último valor que se fijó, aunque todavía no
//     haya entrado en vigencia (por la regla de "cambia desde el mes
//     siguiente").
// vigente_desde siempre es "YYYY-MM-DD" (primer día de un mes, fecha
// calendario, no un instante) — comparar como string funciona porque el
// formato es lexicográficamente ordenable.

export interface HistorialRow {
  vigente_desde: string;
}

export function vigenteEnMes<T extends HistorialRow>(
  rows: T[],
  getId: (row: T) => string,
  mesKey: string
): Map<string, T> {
  const limite = `${mesKey}-01`;
  const result = new Map<string, T>();
  for (const row of rows) {
    if (row.vigente_desde > limite) continue;
    const id = getId(row);
    const actual = result.get(id);
    if (!actual || row.vigente_desde > actual.vigente_desde) {
      result.set(id, row);
    }
  }
  return result;
}

export function masReciente<T extends HistorialRow>(
  rows: T[],
  getId: (row: T) => string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const id = getId(row);
    const actual = result.get(id);
    if (!actual || row.vigente_desde > actual.vigente_desde) {
      result.set(id, row);
    }
  }
  return result;
}

// ¿El valor con este vigente_desde ya está en vigor en mesActualKey
// ("YYYY-MM"), o todavía está pendiente para un mes futuro?
export function estaVigente(vigenteDesde: string, mesActualKey: string): boolean {
  return vigenteDesde <= `${mesActualKey}-01`;
}

// "agosto de 2026" a partir de un vigente_desde ("2026-08-01") — UTC
// neutro a propósito, igual que formatMesAplicable en admin/page.tsx:
// es una fecha calendario, no un instante, así que no debe arrastrar
// ningún corrimiento de zona horaria al mostrarse.
export function formatMesVigencia(vigenteDesde: string): string {
  const [year, month] = vigenteDesde.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}
