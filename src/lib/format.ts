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
