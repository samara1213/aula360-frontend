import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError } from '@/api/errors';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { NotFoundPage } from '@/features/layout/status-pages';

/**
 * Página de detalle: enlace para volver y, según la carga, esqueleto, «no
 * encontrada» (id inválido, 404 o 400), error con «Reintentar» o el contenido.
 */
export function DetailPage<T>({
  back,
  validId,
  query,
  noun,
  children,
}: {
  back: { to: string; label: string };
  /** false: «no encontrada» sin consultar (p. ej. un id que no es UUID). */
  validId: boolean;
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  /** Para el error: «el docente». */
  noun: string;
  children: (data: T) => ReactNode;
}) {
  const { data, isPending, error, refetch } = query;
  return (
    <div className="flex flex-col gap-6">
      <Link
        to={back.to}
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-md font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        {back.label}
      </Link>
      {!validId ? (
        <NotFoundPage />
      ) : error ? (
        error instanceof ApiError && (error.status === 404 || error.status === 400) ? (
          <NotFoundPage />
        ) : (
          <Alert variant="error">
            No pudimos cargar {noun}.{' '}
            <button
              type="button"
              className="cursor-pointer font-bold text-primary underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </Alert>
        )
      ) : isPending || data === undefined ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        children(data)
      )}
    </div>
  );
}
