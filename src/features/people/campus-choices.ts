import { ApiError } from '@/api/errors';
import { useIdParam } from '@/components/data/list-params';
import { useCampuses } from '@/features/institution/institution-api';
import { usePermissions } from '@/features/menu/menu';

// Una institución tiene pocas sedes: la primera página (máximo del backend) basta.
const ALL_ACTIVE = { page: 1, limit: 100, isActive: true } as const;

export type PeopleSlug = 'people.teachers' | 'people.students';
/** Pantallas que eligen una sede: docentes, estudiantes y cursos (3d-2). */
export type CampusSlug = PeopleSlug | 'academic.courses';

/**
 * Sedes activas que se pueden elegir para un docente, estudiante o curso. Sin sede
 * (toda la institución) solo si quien lo crea tiene el permiso en toda ella:
 * con el permiso limitado a sedes, el backend exige una de las suyas.
 *
 * Las sedes se leen de /campuses, que exige el permiso de Sedes: sin él
 * (`forbidden`) no se puede elegir una y se dice por qué (I6 de la 3c).
 */
export function useCampusChoices(slug: CampusSlug) {
  // Sin el permiso de ver Sedes no se piden (I1 de la 3d-2).
  const menu = usePermissions('institution.campuses');
  const canView = menu.view;
  const campuses = useCampuses(ALL_ACTIVE, { enabled: canView });
  const wide = usePermissions(slug).institutionWide;
  const forbidden =
    (!menu.isLoading && !canView) ||
    (campuses.error instanceof ApiError && campuses.error.status === 403);
  return {
    options: (campuses.data?.data ?? []).map((campus) => ({
      value: campus.id,
      label: campus.name,
    })),
    allowNone: wide.create,
    isPending: canView ? campuses.isPending : menu.isLoading,
    isError: campuses.isError && !forbidden,
    forbidden,
  };
}

/** Filtro «Sede» de un listado, en la URL (`?campus=`); solo un UUID llega a la API. */
export function useCampusFilter() {
  const { value, id, set } = useIdParam('campus');
  return { value, campusId: id, set };
}
