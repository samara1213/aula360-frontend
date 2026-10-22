import { describe, expect, it } from 'vitest';
import {
  exceedsCeiling,
  grantsFrom,
  sameGrants,
  toggle,
  toInput,
  type Grants,
  type MatrixRow,
} from './permission-matrix-logic';

const row = (id: string, children: MatrixRow[] = []): MatrixRow => ({ id, name: id, children });
// a → a1 → a11, y b suelta.
const ROWS = [row('a', [row('a1', [row('a11')])]), row('b')];
const FULL = { view: true, create: true, update: true, delete: true };
const VIEW = { view: true, create: false, update: false, delete: false };

describe('matriz de permisos', () => {
  it('ver una opción marca «ver» en sus ancestros', () => {
    const next = toggle({}, ROWS, null, 'a11', 'view', true);
    expect(Object.keys(next).sort()).toEqual(['a', 'a1', 'a11']);
    expect(next.a).toEqual(VIEW);
  });

  it('crear, editar o borrar implican ver', () => {
    const next = toggle({}, ROWS, null, 'b', 'delete', true);
    expect(next.b).toEqual({ view: true, create: false, update: false, delete: true });
  });

  it('quitar «ver» quita la opción y toda su rama', () => {
    const start: Grants = { a: FULL, a1: FULL, a11: FULL, b: VIEW };
    const next = toggle(start, ROWS, null, 'a1', 'view', false);
    expect(Object.keys(next).sort()).toEqual(['a', 'b']);
  });

  it('quitar otra acción deja «ver»', () => {
    const next = toggle({ b: FULL }, ROWS, null, 'b', 'update', false);
    expect(next.b).toEqual({ view: true, create: true, update: false, delete: true });
  });

  it('con tope: no otorga lo que quien edita no tiene, ni lo agrega a los ancestros', () => {
    // Puede ver y crear en a11 y ver a1, pero no tiene a.
    const ceiling = { a1: VIEW, a11: { ...VIEW, create: true } };
    expect(toggle({}, ROWS, ceiling, 'a11', 'delete', true)).toEqual({});
    const next = toggle({}, ROWS, ceiling, 'a11', 'create', true);
    expect(Object.keys(next).sort()).toEqual(['a1', 'a11']);
  });

  it('detecta un rol con más permisos que el tope en las opciones visibles', () => {
    const ceiling = { b: VIEW };
    expect(exceedsCeiling({ b: VIEW }, ROWS, ceiling)).toBe(false);
    expect(exceedsCeiling({ b: { ...VIEW, update: true } }, ROWS, ceiling)).toBe(true);
    // Una opción que la matriz no muestra no cuenta (la juzga el backend).
    expect(exceedsCeiling({ oculta: FULL }, ROWS, ceiling)).toBe(false);
    expect(exceedsCeiling({ b: FULL }, ROWS, null)).toBe(false);
  });

  it('al guardar conserva los permisos de opciones que la matriz no muestra', () => {
    const original = [
      {
        menuOptionId: 'b',
        slug: 'b',
        name: 'b',
        canCreate: true,
        canUpdate: false,
        canDelete: false,
      },
      {
        menuOptionId: 'oculta',
        slug: 'x',
        name: 'x',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
      },
    ];
    const grants = toggle(grantsFrom(original), ROWS, null, 'b', 'view', false);
    expect(toInput(grants, ROWS, original)).toEqual([
      { menuOptionId: 'oculta', canCreate: true, canUpdate: true, canDelete: false },
    ]);
  });

  it('compara dos juegos de permisos', () => {
    expect(sameGrants({ b: VIEW }, { b: { ...VIEW } })).toBe(true);
    expect(sameGrants({ b: VIEW }, {})).toBe(false);
  });
});
