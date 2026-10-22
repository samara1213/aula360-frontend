import type { PerformanceLevelInput } from '@/api/types';

/** Fila del editor: los valores como se escriben («4,6»). */
export type LevelRow = { name: string; minScore: string; maxScore: string };

export type LevelErrors = {
  rows: Partial<Record<keyof LevelRow, string>>[];
  /** Error del conjunto (cobertura de la escala). */
  general?: string;
};

export const MAX_LEVELS = 10;

/** Límite de un nivel con sus dos decimales, como en el boletín: 1 → «1,00». */
export function formatLevelScore(value: number): string {
  return value.toFixed(2).replace('.', ',');
}
const NAME_MAX = 50;

/** «4,6» o «4.6» → 4.6; null si no es un número con hasta dos decimales. */
export function parseScore(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}

/** En centésimas, para comparar sin errores de coma flotante. */
const cents = (value: number) => Math.round(value * 100);

/**
 * Las mismas reglas que `validateLevels` del backend: nombres únicos, mínimo
 * ≤ máximo y, ordenados, de la nota mínima a la máxima de la escala sin huecos
 * ni cruces (pasos de 0,01). Devuelve los niveles listos para enviar o los errores.
 */
export function validateLevels(
  rows: LevelRow[],
  scale: { min: number; max: number },
): { levels: PerformanceLevelInput[] } | { errors: LevelErrors } {
  const errors: LevelErrors = { rows: rows.map(() => ({})) };
  const levels: (PerformanceLevelInput & { index: number })[] = [];
  const names = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowErrors = errors.rows[index] ?? {};
    const name = row.name.trim();
    if (!name) rowErrors.name = 'Escribe el nombre.';
    else if (name.length > NAME_MAX) rowErrors.name = `Máximo ${String(NAME_MAX)} caracteres.`;
    else {
      const key = name.toLocaleLowerCase('es');
      if (names.has(key)) rowErrors.name = 'Ese nombre ya está en otro nivel.';
      names.set(key, index);
    }
    const minScore = parseScore(row.minScore);
    const maxScore = parseScore(row.maxScore);
    if (minScore === null) rowErrors.minScore = 'Un número con hasta dos decimales.';
    if (maxScore === null) rowErrors.maxScore = 'Un número con hasta dos decimales.';
    if (minScore !== null && maxScore !== null) {
      if (cents(minScore) > cents(maxScore)) rowErrors.maxScore = 'Menor que «Desde».';
      else levels.push({ name, minScore, maxScore, index });
    }
  });

  if (rows.length === 0) errors.general = 'Agrega al menos un nivel.';
  const hasRowErrors = errors.rows.some((e) => Object.keys(e).length > 0);
  if (hasRowErrors || errors.general) return { errors };

  const sorted = [...levels].sort((a, b) => cents(a.minScore) - cents(b.minScore));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first && cents(first.minScore) !== cents(scale.min)) {
    (errors.rows[first.index] ?? {}).minScore =
      `El primer nivel empieza en ${formatLevelScore(scale.min)}.`;
  }
  if (last && cents(last.maxScore) !== cents(scale.max)) {
    (errors.rows[last.index] ?? {}).maxScore =
      `El último nivel termina en ${formatLevelScore(scale.max)}.`;
  }
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (!previous || !current) continue;
    const expected = cents(previous.maxScore) + 1;
    const start = cents(current.minScore);
    if (start !== expected) {
      (errors.rows[current.index] ?? {}).minScore =
        `Debe empezar en ${formatLevelScore(expected / 100)}: ${
          start < expected ? 'se cruza' : 'deja un hueco'
        } con ${previous.name}.`;
    }
  }
  if (errors.rows.some((e) => Object.keys(e).length > 0)) {
    errors.general = `Los niveles deben cubrir de ${formatLevelScore(scale.min)} a ${formatLevelScore(scale.max)} sin huecos ni cruces.`;
    return { errors };
  }
  return { levels: sorted.map(({ name, minScore, maxScore }) => ({ name, minScore, maxScore })) };
}
