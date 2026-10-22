import type { MenuPermissions, RolePermission, RolePermissionInput } from '@/api/types';

export type Action = keyof MenuPermissions;
export const ACTIONS: readonly Action[] = ['view', 'create', 'update', 'delete'];

/** Fila de la matriz: una opción del menú con sus hijas. */
export type MatrixRow = {
  id: string;
  name: string;
  /** Opción desactivada (solo en el árbol completo del SUPER_ADMIN). */
  inactive?: boolean;
  children: MatrixRow[];
};

/** Permisos del rol por opción de menú (solo las otorgadas: view true). */
export type Grants = Readonly<Record<string, MenuPermissions>>;

/**
 * Tope: lo que quien edita puede otorgar (sus permisos en toda la institución).
 * null = sin tope (SUPER_ADMIN con roles globales).
 */
export type Ceiling = Grants | null;

const NONE: MenuPermissions = { view: false, create: false, update: false, delete: false };

export function grantsFrom(permissions: readonly RolePermission[]): Grants {
  return Object.fromEntries(
    permissions.map((p) => [
      p.menuOptionId,
      { view: true, create: p.canCreate, update: p.canUpdate, delete: p.canDelete },
    ]),
  );
}

export function canGrant(ceiling: Ceiling, id: string, action: Action): boolean {
  if (ceiling === null) return true;
  return Object.hasOwn(ceiling, id) && ceiling[id]?.[action] === true;
}

function parents(rows: readonly MatrixRow[], parent: string | null = null) {
  const map = new Map<string, string | null>();
  for (const row of rows) {
    map.set(row.id, parent);
    for (const [id, p] of parents(row.children, row.id)) map.set(id, p);
  }
  return map;
}

function descendants(row: MatrixRow): string[] {
  return row.children.flatMap((child) => [child.id, ...descendants(child)]);
}

function findRow(rows: readonly MatrixRow[], id: string): MatrixRow | undefined {
  for (const row of rows) {
    if (row.id === id) return row;
    const found = findRow(row.children, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Marca o desmarca una acción y mantiene la matriz coherente:
 * - Crear, editar o borrar implican ver.
 * - Ver una opción marca «ver» en sus ancestros (si se pueden otorgar): así el
 *   grupo aparece en el menú de quien tenga el rol.
 * - Quitar «ver» quita la opción entera y toda su rama.
 */
export function toggle(
  grants: Grants,
  rows: readonly MatrixRow[],
  ceiling: Ceiling,
  id: string,
  action: Action,
  checked: boolean,
): Grants {
  const next: Record<string, MenuPermissions> = { ...grants };
  if (!checked && action === 'view') {
    const row = findRow(rows, id);
    const removed = new Set([id, ...(row ? descendants(row) : [])]);
    return Object.fromEntries(Object.entries(next).filter(([key]) => !removed.has(key)));
  }
  if (!checked) {
    const current = next[id];
    if (current) next[id] = { ...current, [action]: false };
    return next;
  }
  if (!canGrant(ceiling, id, action)) return grants;
  next[id] = { ...(next[id] ?? NONE), view: true, [action]: true };
  const parentOf = parents(rows);
  for (let p = parentOf.get(id) ?? null; p !== null; p = parentOf.get(p) ?? null) {
    if (!next[p] && canGrant(ceiling, p, 'view')) next[p] = { ...NONE, view: true };
  }
  return next;
}

/** Opciones visibles en la matriz con algún permiso que quien edita no tiene. */
export function exceedsCeiling(grants: Grants, rows: readonly MatrixRow[], ceiling: Ceiling) {
  if (ceiling === null) return false;
  const visible = new Set(parents(rows).keys());
  return Object.entries(grants).some(
    ([id, flags]) =>
      visible.has(id) && ACTIONS.some((action) => flags[action] && !canGrant(ceiling, id, action)),
  );
}

/**
 * Cuerpo del PUT (reemplaza todos los permisos): lo de la matriz más, sin
 * cambios, lo que el rol tiene en opciones que la matriz no muestra (p. ej.
 * desactivadas): no se pierden al guardar.
 */
export function toInput(
  grants: Grants,
  rows: readonly MatrixRow[],
  original: readonly RolePermission[],
): RolePermissionInput[] {
  const visible = new Set(parents(rows).keys());
  const fromMatrix = Object.entries(grants)
    .filter(([, flags]) => flags.view)
    .map(([menuOptionId, flags]) => ({
      menuOptionId,
      canCreate: flags.create,
      canUpdate: flags.update,
      canDelete: flags.delete,
    }));
  const hidden = original
    .filter((p) => !visible.has(p.menuOptionId))
    .map(({ menuOptionId, canCreate, canUpdate, canDelete }) => ({
      menuOptionId,
      canCreate,
      canUpdate,
      canDelete,
    }));
  return [...fromMatrix.filter((p) => visible.has(p.menuOptionId)), ...hidden];
}

export function sameGrants(a: Grants, b: Grants): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((id) => ACTIONS.every((action) => a[id]?.[action] === b[id]?.[action]));
}
