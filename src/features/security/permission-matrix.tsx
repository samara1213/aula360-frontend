import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ACTIONS,
  canGrant,
  type Action,
  type Ceiling,
  type Grants,
  type MatrixRow,
} from './permission-matrix-logic';

const LABELS: Record<Action, string> = {
  view: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Borrar',
};

type PermissionMatrixProps = {
  rows: readonly MatrixRow[];
  grants: Grants;
  ceiling: Ceiling;
  readOnly: boolean;
  onToggle: (id: string, action: Action, checked: boolean) => void;
};

/**
 * Permisos de un rol: filas = opciones del menú (Padre → Hijo → Nieto),
 * columnas = acciones. Una casilla que quien edita no puede otorgar queda
 * deshabilitada. Cabe en celular sin desplazamiento horizontal.
 */
export function PermissionMatrix({
  rows,
  grants,
  ceiling,
  readOnly,
  onToggle,
}: PermissionMatrixProps) {
  return (
    <table className="w-full max-w-4xl table-fixed border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border bg-card">
      <caption className="sr-only">Permisos del rol por opción del menú</caption>
      <colgroup>
        <col />
        {ACTIONS.map((action) => (
          <col key={action} className="w-12 sm:w-20" />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th
            scope="col"
            className="border-b border-rule bg-muted/60 px-3 py-3 text-left text-sm font-bold text-muted-foreground sm:px-4"
          >
            Opción del menú
          </th>
          {ACTIONS.map((action) => (
            <th
              key={action}
              scope="col"
              className="border-b border-rule bg-muted/60 px-0 py-3 text-center text-xs font-bold text-muted-foreground sm:text-sm"
            >
              {LABELS[action]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <MatrixRows
            key={row.id}
            row={row}
            depth={0}
            grants={grants}
            ceiling={ceiling}
            readOnly={readOnly}
            onToggle={onToggle}
          />
        ))}
      </tbody>
    </table>
  );
}

function MatrixRows({
  row,
  depth,
  ...props
}: Omit<PermissionMatrixProps, 'rows'> & { row: MatrixRow; depth: number }) {
  const { grants, ceiling, readOnly, onToggle } = props;
  const flags = grants[row.id];
  return (
    <>
      <tr className="group hover:bg-accent/40">
        <th
          scope="row"
          className={cn(
            'border-b border-border py-2 pr-2 text-left align-middle text-[15px] font-normal break-words',
            depth === 0 && 'font-bold',
          )}
          style={{ paddingLeft: `${String(12 + depth * 18)}px` }}
        >
          <span className="inline-flex flex-wrap items-center gap-2">
            {row.name}
            {row.inactive && <Badge variant="inactive">Inactiva</Badge>}
          </span>
        </th>
        {ACTIONS.map((action) => {
          const allowed = canGrant(ceiling, row.id, action);
          const checked = flags?.[action] === true;
          return (
            <td key={action} className="border-b border-border p-0 text-center align-middle">
              <label className="inline-flex size-11 cursor-pointer items-center justify-center has-disabled:cursor-not-allowed">
                <input
                  type="checkbox"
                  className="size-5 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                  checked={checked}
                  // Se puede quitar lo que no se podría otorgar; nunca agregarlo.
                  disabled={readOnly || (!allowed && !checked)}
                  aria-label={`${LABELS[action]}: ${row.name}`}
                  onChange={(e) => {
                    onToggle(row.id, action, e.target.checked);
                  }}
                />
              </label>
            </td>
          );
        })}
      </tr>
      {row.children.map((child) => (
        <MatrixRows key={child.id} row={child} depth={depth + 1} {...props} />
      ))}
    </>
  );
}
