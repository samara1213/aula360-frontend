import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Enlace a la ficha de una fila (el nombre en la primera columna de un listado). */
export function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
    >
      {children}
    </Link>
  );
}
