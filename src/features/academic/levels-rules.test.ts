import { describe, expect, it } from 'vitest';
import { parseScore, validateLevels, type LevelRow } from './levels-rules';

const SCALE = { min: 1, max: 5 };
const row = (name: string, minScore: string, maxScore: string): LevelRow => ({
  name,
  minScore,
  maxScore,
});

describe('parseScore', () => {
  it('acepta coma o punto y hasta dos decimales', () => {
    expect(parseScore('4,6')).toBe(4.6);
    expect(parseScore(' 4.59 ')).toBe(4.59);
    expect(parseScore('5')).toBe(5);
    expect(parseScore('4,599')).toBeNull();
    expect(parseScore('')).toBeNull();
    expect(parseScore('-1')).toBeNull();
    expect(parseScore('abc')).toBeNull();
  });
});

describe('validateLevels', () => {
  it('ordena por nota y devuelve los niveles listos para enviar', () => {
    const result = validateLevels([row('Alto', '3', '5'), row('Bajo', '1', '2,99')], SCALE);
    expect(result).toEqual({
      levels: [
        { name: 'Bajo', minScore: 1, maxScore: 2.99 },
        { name: 'Alto', minScore: 3, maxScore: 5 },
      ],
    });
  });

  it('señala nombres repetidos sin distinguir mayúsculas, y mínimos mayores que máximos', () => {
    const result = validateLevels([row('Bajo', '1', '2,99'), row('bajo', '3', '2')], SCALE);
    expect(result).toEqual({
      errors: {
        rows: [{}, { name: 'Ese nombre ya está en otro nivel.', maxScore: 'Menor que «Desde».' }],
      },
    });
  });

  it('señala cruces, huecos y los extremos de la escala en la fila que corresponde', () => {
    const result = validateLevels(
      [row('Bajo', '1,5', '3'), row('Básico', '3', '3,99'), row('Alto', '4,2', '4,9')],
      SCALE,
    );
    if (!('errors' in result)) throw new Error('debía fallar');
    expect(result.errors.rows).toEqual([
      { minScore: 'El primer nivel empieza en 1,00.' },
      { minScore: 'Debe empezar en 3,01: se cruza con Bajo.' },
      {
        minScore: 'Debe empezar en 4,00: deja un hueco con Básico.',
        maxScore: 'El último nivel termina en 5,00.',
      },
    ]);
    expect(result.errors.general).toMatch(/sin huecos ni cruces/);
  });

  it('exige al menos un nivel', () => {
    expect(validateLevels([], SCALE)).toEqual({
      errors: { rows: [], general: 'Agrega al menos un nivel.' },
    });
  });
});
