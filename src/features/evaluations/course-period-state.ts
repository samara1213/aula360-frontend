import type { Course, Period } from '@/api/types';
import { useSession } from '@/auth/session';
import { pickOption, useIdParam } from '@/components/data/list-params';
import { usePeriods } from '@/features/academic/academic-api';
import { useCourseOptions, useYearFilter } from '@/features/academic/options';
import { usePermissions } from '@/features/menu/menu';
import { useMyAssignments, useMyPeriods } from './evaluations-api';
import { defaultPeriod, schoolToday } from './score-rules';

// Elegir un curso y un periodo (cuadro de notas y boletines), con los filtros
// en la URL (`?year=`, `?course=`, `?period=`) aplicados solo si están entre
// las opciones.

/** Roles de la sesión en la institución activa. */
export function useActiveRoles(): string[] {
  const { data: session } = useSession();
  return session?.institutions.find((i) => i.id === session.activeInstitutionId)?.roles ?? [];
}

/**
 * Con los permisos de ver Años lectivos y Cursos, el año (siempre uno: con
 * «todos» no hay cursos que elegir) y sus cursos; si no y `ownLoad`, los
 * cursos de la carga propia (el docente). Los periodos, del año del curso:
 * con el permiso de ver Periodos, de `/periods`; si no, de la carga propia.
 */
export function useCoursePeriod({ ownLoad }: { ownLoad: boolean }) {
  const today = schoolToday();
  const yearsView = usePermissions('academic.years').view;
  const coursesView = usePermissions('academic.courses').view;
  const byYear = yearsView && coursesView;
  const year = useYearFilter({ allowAll: false });
  const courseParam = useIdParam('course');
  const periodParam = useIdParam('period');
  const mine = useMyAssignments({ enabled: ownLoad });
  const yearCourses = useCourseOptions(year.academicYearId, { enabled: byYear });

  const mineCourses = ownLoad
    ? [...new Map((mine.data ?? []).map((a) => [a.course.id, a.course])).values()]
    : [];
  // Solo cursos del año elegido: mientras carga otro año, la lista anterior
  // (placeholderData) no valida un ?course= de ese año (B2 de la 3e-2).
  const courses: Course[] = byYear
    ? yearCourses.courses.filter((c) => c.academicYear.id === year.academicYearId)
    : mineCourses;
  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.name} · ${c.grade.name} · ${c.campus.name}`,
  }));
  const coursesPending = byYear
    ? year.isPending || yearCourses.isPending
    : ownLoad && mine.isPending;
  const courseChoice = pickOption(courseParam, courseOptions, coursesPending);
  const course = courses.find((c) => c.id === courseChoice.id);

  const periodsView = usePermissions('academic.periods');
  const yearId = course?.academicYear.id;
  const yearPeriods = usePeriods(periodsView.view ? yearId : undefined);
  const myPeriods = useMyPeriods({
    enabled: ownLoad && course !== undefined && !periodsView.isLoading && !periodsView.view,
  });
  const periods: Period[] = periodsView.view
    ? (yearPeriods.data ?? [])
    : (myPeriods.data ?? []).filter((p) => p.academicYearId === yearId);
  const periodsPending = periodsView.view ? yearPeriods.isPending : ownLoad && myPeriods.isPending;
  const period = periods.find((p) => p.id === periodParam.id) ?? defaultPeriod(periods, today);
  const ownCourse = mine.data?.some((a) => a.course.id === course?.id) ?? false;

  return {
    byYear,
    year,
    courseParam,
    periodParam,
    courseOptions,
    courseChoice,
    coursesPending,
    course,
    periods,
    periodsPending,
    period,
    /** Sin periodos porque le falta el permiso de verlos (no porque no haya). */
    periodsForbidden: !periodsView.view && !ownCourse,
  };
}

export type CoursePeriod = ReturnType<typeof useCoursePeriod>;
