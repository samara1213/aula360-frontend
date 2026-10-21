import { ChevronLeft, ChevronRight, EllipsisVertical } from 'lucide-react';
import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

type DataListProps<T> = {
  /** Nombre del listado para lectores de pantalla («Sedes»). */
  label: string;
  /** La primera columna es el título de cada tarjeta en celular. */
  columns: readonly Column<T>[];
  rows: readonly T[] | undefined;
  getKey: (row: T) => string;
  isPending: boolean;
  /** Recargando con los datos anteriores en pantalla (cambio de página o filtro). */
  isFetching?: boolean;
  error: unknown;
  onRetry: () => void;
  empty: ReactNode;
  actions?: (row: T) => ReactNode;
};

/**
 * Tabla desde tablet; en celular, una tarjeta por fila con las columnas como
 * pares «encabezado: valor». Sin desplazamiento horizontal en ningún tamaño.
 */
export function DataList<T>({
  label,
  columns,
  rows,
  getKey,
  isPending,
  isFetching = false,
  error,
  onRetry,
  empty,
  actions,
}: DataListProps<T>) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label={`Cargando ${label}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="error">
        No pudimos cargar la lista.{' '}
        <button
          type="button"
          className="cursor-pointer font-bold text-primary underline"
          onClick={onRetry}
        >
          Reintentar
        </button>
      </Alert>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
        {empty}
      </div>
    );
  }

  const [first, ...rest] = columns;
  return (
    <div className={cn('transition-opacity', isFetching && 'opacity-60')} aria-busy={isFetching}>
      <table className="hidden w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border bg-card md:table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'border-b border-rule bg-muted/60 px-4 py-3 text-left text-sm font-bold text-muted-foreground',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="w-14 border-b border-rule bg-muted/60 px-2 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getKey(row)} className="group hover:bg-accent/40">
              {columns.map((column, index) => {
                const Cell = index === 0 ? 'th' : 'td';
                return (
                  <Cell
                    key={column.key}
                    {...(index === 0 ? { scope: 'row' } : {})}
                    className={cn(
                      'border-b border-border px-4 py-3 text-left align-middle group-last:border-b-0',
                      index === 0 && 'font-bold',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </Cell>
                );
              })}
              {actions && (
                <td className="border-b border-border px-2 py-2 text-right group-last:border-b-0">
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label={label} className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={getKey(row)}
            className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              {first && <div className="font-bold break-words">{first.cell(row)}</div>}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {rest.map((column) => (
                  <div key={column.key} className="contents">
                    <dt className="text-muted-foreground">{column.header}</dt>
                    <dd className="min-w-0 break-words">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {actions && <div className="-mt-1.5 -mr-1.5 shrink-0">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Botón «⋮» con el menú de acciones de una fila. */
export function RowActions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

type Meta = { page: number; limit: number; total: number; totalPages: number };

export function Pagination({
  meta,
  onPage,
  noun,
}: {
  meta: Meta | undefined;
  onPage: (page: number) => void;
  /** Plural del elemento («sedes»). */
  noun: string;
}) {
  const outOfRange = meta !== undefined && meta.totalPages > 0 && meta.page > meta.totalPages;
  const goToLast = useEffectEvent(() => {
    if (meta) onPage(meta.totalPages);
  });
  // Una página que ya no existe (se borró lo último, enlace viejo): a la última.
  useEffect(() => {
    if (outOfRange) goToLast();
  }, [outOfRange]);

  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {from}–{to} de {meta.total} {noun}
      </p>
      {meta.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-11 sm:h-9"
            disabled={meta.page <= 1}
            onClick={() => {
              onPage(meta.page - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" />
            Anterior
          </Button>
          <span className="px-2 text-sm">
            Página {meta.page} de {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-11 sm:h-9"
            disabled={meta.page >= meta.totalPages}
            onClick={() => {
              onPage(meta.page + 1);
            }}
          >
            Siguiente
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}
