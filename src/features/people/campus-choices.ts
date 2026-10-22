import { useSearchParams } from 'react-router';
import { ApiError } from '@/api/errors';
import { useCampuses } from '@/features/institution/institution-api';
import { usePermissions } from '@/features/menu/menu';
import { isUuid } from '@/lib/ids';

// Una institución tiene pocas sedes: la primera página (máximo del backend) basta.
const ALL_ACTIVE = { page: 1, limit: 100, isActive: true } as const;

export type PeopleSlug = 'people.teachers' | 'people.students';

/**
 * Sedes activas que se pueden elegir para un docente o estudiante. Sin sede
 * (toda la institución) solo si quien lo crea tiene el permiso en toda ella:
 * con el permiso limitado a sedes, el backend exige una de las suyas.
 *
 * Las sedes se leen de /campuses, que exige el permiso de Sedes: sin él
 * (`forbidden`) no se puede elegir una y se dice por qué (I6 de la 3c).
 */
export function useCampusChoices(slug: PeopleSlug) {
  const campuses = useCampuses(ALL_ACTIVE);
  const wide = usePermissions(slug).institutionWide;
  const forbidden = campuses.error instanceof ApiError && campuses.error.status === 403;
  return {
    options: (campuses.data?.data ?? []).map((campus) => ({
      value: campus.id,
      label: campus.name,
    })),
    allowNone: wide.create,
    isPending: campuses.isPending,
    isError: campuses.isError && !forbidden,
    forbidden,
  };
}

/** Filtro «Sede» de un listado, en la URL (`?campus=`); solo un UUID llega a la API. */
export function useCampusFilter() {
  const [params, setParams] = useSearchParams();
  const value = params.get('campus') ?? '';
  return {
    value,
    campusId: isUuid(value) ? value : undefined,
    set: (next: string) => {
      setParams((prev) => {
        const updated = new URLSearchParams(prev);
        if (next) updated.set('campus', next);
        else updated.delete('campus');
        updated.delete('page');
        return updated;
      });
    },
  };
}
