import type { GradingScale, Period } from '@/api/types';
import { formatScore } from '@/lib/format';

// Reglas de evaluaciones y notas que repiten las del backend (la validación
// definitiva es la suya). Fechas 'YYYY-MM-DD': el orden de texto es el cronológico.

const SCHOOL_TIME_ZONE = 'America/Bogota';

/** Hoy en Colombia ('YYYY-MM-DD'), como `schoolToday` del backend. */
export function schoolToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export type PeriodState = 'upcoming' | 'current' | 'ended';

export function periodState(
  period: Pick<Period, 'startDate' | 'endDate'>,
  today: string,
): PeriodState {
  if (today < period.startDate) return 'upcoming';
  if (today > period.endDate) return 'ended';
  return 'current';
}

/** El periodo en curso; si no hay, el último que empezó; si no, el primero. */
export function defaultPeriod<T extends Pick<Period, 'startDate' | 'endDate'>>(
  periods: readonly T[],
  today: string,
): T | undefined {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    sorted.find((p) => periodState(p, today) === 'current') ??
    sorted.filter((p) => p.startDate <= today).at(-1) ??
    sorted[0]
  );
}

/** Suma de porcentajes a 2 decimales (sin errores de coma flotante). */
export function sumPercentages(items: readonly { percentage: number }[]): number {
  return items.reduce((sum, item) => sum + Math.round(item.percentage * 100), 0) / 100;
}

const DECIMAL = /^\d+([.,]\d{1,2})?$/;

/** Número escrito con coma o punto y hasta 2 decimales ('4,5' → 4.5); undefined si no lo es. */
export function parseDecimal(raw: string): number | undefined {
  const text = raw.trim();
  if (!DECIMAL.test(text)) return undefined;
  return Number(text.replace(',', '.'));
}

export type ParsedScore = { ok: true; value: number | null } | { ok: false; error: string };

/** Lo escrito en una celda: vacío quita la nota; si no, un número dentro de la escala. */
export function parseScore(raw: string, scale: Pick<GradingScale, 'min' | 'max'>): ParsedScore {
  if (raw.trim() === '') return { ok: true, value: null };
  const value = parseDecimal(raw);
  if (value === undefined) {
    return { ok: false, error: 'Escribe un número con hasta 2 decimales, por ejemplo 4,5.' };
  }
  if (value < scale.min || value > scale.max) {
    return {
      ok: false,
      error: `Debe estar entre ${formatScore(scale.min)} y ${formatScore(scale.max)}.`,
    };
  }
  return { ok: true, value };
}

/** Una nota como se escribe en la celda: 4.5 → '4,5'. */
export function scoreInput(score: number | null): string {
  return score === null ? '' : String(score).replace('.', ',');
}

/**
 * Lo pegado desde una hoja de cálculo: una nota por línea (de cada línea, la
 * primera columna). Las líneas vacías del final no cuentan.
 */
export function splitPaste(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 0 && lines.at(-1)?.trim() === '') lines.pop();
  return lines.map((line) => (line.split('\t')[0] ?? '').trim());
}

const ROW_ERROR = /^scores\[\d+\] \(([0-9a-f-]{36})\): (.+)$/i;

/**
 * Errores por fila del 400 del backend («scores[2] (<uuid>): la nota debe
 * estar entre 1 y 5»), por estudiante. Los mensajes que no son de una fila
 * quedan en `general`.
 */
export function rowErrors(messages: readonly string[]) {
  const byStudent = new Map<string, string>();
  const general: string[] = [];
  for (const message of messages) {
    const match = ROW_ERROR.exec(message);
    const [, studentId, text] = match ?? [];
    if (studentId && text) {
      byStudent.set(studentId.toLowerCase(), `${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
    } else {
      general.push(message);
    }
  }
  return { byStudent, general };
}
