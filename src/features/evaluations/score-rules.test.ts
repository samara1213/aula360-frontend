import { describe, expect, it } from 'vitest';
import {
  defaultPeriod,
  parseDecimal,
  parseScore,
  periodState,
  rowErrors,
  schoolToday,
  scoreInput,
  splitPaste,
  sumPercentages,
} from './score-rules';

const SCALE = { min: 1, max: 5 };

describe('parseScore', () => {
  it('acepta coma o punto y hasta 2 decimales', () => {
    expect(parseScore('4,5', SCALE)).toEqual({ ok: true, value: 4.5 });
    expect(parseScore(' 3.25 ', SCALE)).toEqual({ ok: true, value: 3.25 });
    expect(parseScore('5', SCALE)).toEqual({ ok: true, value: 5 });
  });

  it('vacío quita la nota', () => {
    expect(parseScore('', SCALE)).toEqual({ ok: true, value: null });
    expect(parseScore('   ', SCALE)).toEqual({ ok: true, value: null });
  });

  it('rechaza texto, 3 decimales y notas fuera de la escala', () => {
    expect(parseScore('cuatro', SCALE).ok).toBe(false);
    expect(parseScore('4,555', SCALE).ok).toBe(false);
    expect(parseScore('-1', SCALE).ok).toBe(false);
    expect(parseScore('5,1', SCALE)).toEqual({ ok: false, error: 'Debe estar entre 1,0 y 5,0.' });
    expect(parseScore('0,99', SCALE).ok).toBe(false);
  });
});

describe('parseDecimal y scoreInput', () => {
  it('ida y vuelta con coma decimal', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('1e2')).toBeUndefined();
    expect(scoreInput(4.5)).toBe('4,5');
    expect(scoreInput(null)).toBe('');
  });
});

describe('sumPercentages', () => {
  it('suma sin errores de coma flotante', () => {
    expect(
      sumPercentages([{ percentage: 33.33 }, { percentage: 33.33 }, { percentage: 33.34 }]),
    ).toBe(100);
    expect(sumPercentages([{ percentage: 0.1 }, { percentage: 0.2 }])).toBe(0.3);
  });
});

describe('periodos', () => {
  const p1 = { startDate: '2026-02-01', endDate: '2026-04-10' };
  const p2 = { startDate: '2026-04-20', endDate: '2026-06-30' };

  it('estado según hoy', () => {
    expect(periodState(p1, '2026-01-31')).toBe('upcoming');
    expect(periodState(p1, '2026-04-10')).toBe('current');
    expect(periodState(p1, '2026-04-11')).toBe('ended');
  });

  it('predeterminado: el en curso, si no el último que empezó, si no el primero', () => {
    expect(defaultPeriod([p2, p1], '2026-03-01')).toBe(p1);
    expect(defaultPeriod([p1, p2], '2026-04-15')).toBe(p1);
    expect(defaultPeriod([p2, p1], '2026-01-01')).toBe(p1);
    expect(defaultPeriod<typeof p1>([], '2026-01-01')).toBeUndefined();
  });

  it('hoy se cuenta en la hora de Colombia', () => {
    // 2026-03-11 02:00 UTC es 2026-03-10 a las 21:00 en Bogotá.
    expect(schoolToday(new Date('2026-03-11T02:00:00Z'))).toBe('2026-03-10');
  });
});

describe('splitPaste', () => {
  it('una nota por línea, primera columna, sin líneas vacías al final', () => {
    expect(splitPaste('4,5\r\n3\t(ignorada)\n\n')).toEqual(['4,5', '3']);
    expect(splitPaste('4')).toEqual(['4']);
  });
});

describe('rowErrors', () => {
  it('reparte los errores del 400 por estudiante', () => {
    const id = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const { byStudent, general } = rowErrors([
      `scores[0] (${id}): la nota debe estar entre 1 y 5`,
      'Otro error',
    ]);
    expect(byStudent.get(id)).toBe('La nota debe estar entre 1 y 5.');
    expect(general).toEqual(['Otro error']);
  });
});
