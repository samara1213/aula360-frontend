import { useSearchParams } from 'react-router';

export const PAGE_SIZE = 20;
/** Igual que SearchQueryDto del backend. */
export const SEARCH_MAX = 100;
/** Igual que MAX_PAGE de PaginationDto: más allá el backend responde 400. */
export const MAX_PAGE = 10_000;

export type StatusFilter = 'active' | 'inactive' | 'all';

const STATUSES: readonly StatusFilter[] = ['active', 'inactive', 'all'];

type Patch = { page?: number; search?: string; status?: StatusFilter };

/**
 * Página, búsqueda y estado de un listado, guardados en la URL
 * (`?page=2&search=ana&status=all`): un enlace o «atrás» conservan la vista.
 * Lo que llega de la URL se valida; un valor raro vuelve al predeterminado.
 */
export function useListParams(defaultStatus: StatusFilter = 'active') {
  const [params, setParams] = useSearchParams();

  const rawPage = Number(params.get('page'));
  // Una página mayor que la última vuelve a la última (Pagination).
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, MAX_PAGE) : 1;
  const search = (params.get('search') ?? '').slice(0, SEARCH_MAX);
  const rawStatus = params.get('status');
  const status = STATUSES.find((s) => s === rawStatus) ?? defaultStatus;

  const update = (patch: Patch) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const set = (key: string, value: string | undefined) => {
          if (value) next.set(key, value);
          else next.delete(key);
        };
        if (patch.search !== undefined) set('search', patch.search.trim() || undefined);
        if (patch.status !== undefined)
          set('status', patch.status === defaultStatus ? undefined : patch.status);
        // Cambiar el filtro vuelve a la primera página.
        const filterChanged = patch.search !== undefined || patch.status !== undefined;
        const nextPage = patch.page ?? (filterChanged ? 1 : page);
        set('page', nextPage > 1 ? String(nextPage) : undefined);
        return next;
      },
      // Escribir en la búsqueda no llena el historial.
      { replace: patch.search !== undefined },
    );
  };

  /** Parámetros para la API (ListQueryDto). */
  const query = {
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status === 'all' ? {} : { isActive: status === 'active' }),
  };

  return { page, search, status, update, query };
}
