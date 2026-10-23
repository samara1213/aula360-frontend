const percentFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** Porcentaje con coma decimal y sin ceros de más: 20 → «20 %», 12.5 → «12,5 %». */
export function formatPercent(value: number): string {
  return `${percentFormat.format(value)} %`;
}

const scoreFormat = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

/** Nota o valor de la escala con coma decimal: 4.5 → «4,5». */
export function formatScore(value: number): string {
  return scoreFormat.format(value);
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/**
 * Fecha sin hora del backend ('2026-02-02'). Se arma en la hora local: con
 * `new Date('2026-02-02')` (medianoche UTC) en Colombia saldría el día anterior.
 */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return day;
  return dateFormat.format(new Date(year, month - 1, date));
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' de un día que existe (no '2026-02-31'). I4 de la 3d-1. */
export function isDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
