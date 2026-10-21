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
