import { useSearchParams } from 'react-router';
import { ApiError } from '@/api/errors';
import type { Teacher } from '@/api/types';
import { usePermissions } from '@/features/menu/menu';
import { useCatalog, useCourses, useYearChoices } from './academic-api';

// Opciones y filtros que comparten cursos, carga académica y matrículas.

/** Un listado de opciones del backend: un 403 dice qué permiso falta (como I6 de la 3c). */
export const isForbidden = (error: unknown) => error instanceof ApiError && error.status === 403;

/**
 * Año lectivo de un listado (`?year=`): sin parámetro, el activo más reciente;
 * `all`, todos. Sin permiso de ver Años lectivos no hay filtro (todos).
 */
export function useYearFilter() {
  const [params, setParams] = useSearchParams();
  const canList = usePermissions('academic.years').view;
  const years = useYearChoices({ enabled: canList });
  const rows = years.data?.data ?? [];
  const raw = params.get('year') ?? '';
  const fallback = rows.find((y) => y.isActive) ?? rows[0];
  const selected = raw === 'all' ? undefined : (rows.find((y) => y.id === raw) ?? fallback);
  return {
    available: canList && rows.length > 0,
    /** Mientras cargan los años no se sabe cuál es el predeterminado. */
    isPending: canList && years.isPending,
    value: selected?.id ?? 'all',
    academicYearId: selected?.id,
    options: rows.map((y) => ({
      value: y.id,
      label: `${String(y.year)}${y.isActive ? '' : ' (inactivo)'}`,
    })),
    set: (next: string) => {
      setParams((prev) => {
        const updated = new URLSearchParams(prev);
        updated.set('year', next);
        updated.delete('page');
        // El curso elegido es de otro año.
        updated.delete('course');
        return updated;
      });
    },
  };
}

/**
 * El año lectivo predeterminado (el activo más reciente; si no, el más
 * reciente), sin filtro en la URL. Sin permiso de ver Años lectivos, ninguno.
 */
export function useDefaultYear({ enabled = true } = {}) {
  const canList = usePermissions('academic.years').view;
  const years = useYearChoices({ enabled: enabled && canList });
  const rows = years.data?.data ?? [];
  return { canList, year: rows.find((y) => y.isActive) ?? rows[0] };
}

/** Opciones de un catálogo para selectores (grados o materias, pocos: hasta 100). */
export function useCatalogOptions(kind: 'grades' | 'subjects', { enabled = true } = {}) {
  const slug = kind === 'grades' ? 'academic.grades' : 'academic.subjects';
  const canView = usePermissions(slug).view;
  const allowed = canView && enabled;
  const query = useCatalog(kind, { page: 1, limit: 100 }, { enabled: allowed });
  return {
    allowed,
    options: allowed
      ? (query.data?.data ?? []).map((item) => ({ value: item.id, label: item.name }))
      : [],
    isPending: allowed && query.isPending,
    forbidden: !canView || isForbidden(query.error),
  };
}

/**
 * Cursos de un año para selectores (hasta 100), con su sede. Con
 * `anyYear`, los de todos los años (con el año en la etiqueta).
 */
export function useCourseOptions(
  academicYearId: string | undefined,
  { enabled = true, anyYear = false } = {},
) {
  const canView = usePermissions('academic.courses').view;
  const allowed = canView && enabled && (anyYear || academicYearId !== undefined);
  const query = useCourses(
    { page: 1, limit: 100, ...(academicYearId ? { academicYearId } : {}) },
    { enabled: allowed },
  );
  return {
    allowed: canView,
    courses: allowed ? (query.data?.data ?? []) : [],
    options: allowed
      ? (query.data?.data ?? []).map((course) => ({
          value: course.id,
          label: `${course.name} · ${course.grade.name} · ${course.campus.name}${anyYear && !academicYearId ? ` (${String(course.academicYear.year)})` : ''}`,
        }))
      : [],
    isPending: allowed && query.isPending,
  };
}

export const teacherName = (t: Pick<Teacher['user'], 'firstName' | 'lastName'>) =>
  `${t.firstName} ${t.lastName}`;
