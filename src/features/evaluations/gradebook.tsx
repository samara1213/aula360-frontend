import { ApiError } from '@/api/errors';
import type { Course, CourseGradebook } from '@/api/types';
import { useSession } from '@/auth/session';
import { pickOption, useIdParam } from '@/components/data/list-params';
import { ListToolbar, SelectFilter } from '@/components/data/list-toolbar';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePeriods } from '@/features/academic/academic-api';
import { EnrollmentBadge } from '@/features/academic/enrollment-badge';
import { useCourseOptions, useYearFilter } from '@/features/academic/options';
import { YearFilter } from '@/features/academic/pickers';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatDay } from '@/lib/format';
import {
  useCourseGradebook,
  useMyAssignments,
  useMyGradebook,
  useMyPeriods,
} from './evaluations-api';
import { AverageScore, GradeCell, GradesLegend } from './grades';
import { defaultPeriod, schoolToday } from './score-rules';
import { StudentGrades } from './student-grades';

/** Roles de la sesión en la institución activa. */
function useActiveRoles(): string[] {
  const { data: session } = useSession();
  return session?.institutions.find((i) => i.id === session.activeInstitutionId)?.roles ?? [];
}

/**
 * /evaluations/scores: el estudiante ve sus notas; el personal, el cuadro de
 * notas de un curso. Quien es las dos cosas, en pestañas. Personal es quien
 * puede consultar cursos: ve Cursos o tiene carga (no basta con otro rol, I1
 * de la 3e-2). Solo decide qué se muestra: el backend autoriza cada consulta.
 */
export function GradebookPage() {
  const roles = useActiveRoles();
  const isStudent = roles.includes('STUDENT');
  const courses = usePermissions('academic.courses');
  // A quien no es estudiante siempre se le muestra el cuadro (con su mensaje si no tiene cursos).
  const mine = useMyAssignments({ enabled: isStudent && !courses.isLoading && !courses.view });
  const isStaff = !isStudent || courses.view || (mine.data?.length ?? 0) > 0;
  const deciding = isStudent && (courses.isLoading || (!courses.view && mine.isPending));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notas"
        description={
          isStaff
            ? 'El cuadro de notas de cada curso por periodo: la definitiva de cada materia y el promedio.'
            : 'Tus notas del año: la definitiva de cada materia por periodo y el detalle de sus evaluaciones.'
        }
      />
      {deciding ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : isStudent && isStaff ? (
        <Tabs defaultValue="course">
          <TabsList aria-label="Vistas de notas">
            <TabsTrigger value="course">Cuadro de notas</TabsTrigger>
            <TabsTrigger value="mine">Mis notas</TabsTrigger>
          </TabsList>
          <TabsContent value="course" className="flex flex-col gap-6">
            <CourseGradebookView />
          </TabsContent>
          <TabsContent value="mine">
            <MyGrades />
          </TabsContent>
        </Tabs>
      ) : isStudent ? (
        <MyGrades />
      ) : (
        <CourseGradebookView />
      )}
    </div>
  );
}

/** «Mis notas» del estudiante: su año activo. */
function MyGrades() {
  const { data, isPending, error, refetch } = useMyGradebook();
  if (isPending) return <Skeleton className="h-80 rounded-2xl" />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
          <p className="font-bold">Todavía no tienes notas para mostrar.</p>
          <p className="mt-1 text-muted-foreground">
            Aparecerán cuando estés matriculado en un año lectivo activo.
          </p>
        </div>
      );
    }
    return <RetryAlert what="tus notas" onRetry={() => void refetch()} />;
  }
  return <StudentGrades data={data} />;
}

/**
 * Cuadro de un curso en un periodo. Con el permiso de ver Años lectivos se
 * elige el año y sus cursos; si no (el docente), los cursos de su carga.
 * Filtros en la URL (`?year=`, `?course=`, `?period=`), aplicados solo si
 * están entre las opciones.
 */
function CourseGradebookView() {
  const today = schoolToday();
  const yearsView = usePermissions('academic.years').view;
  const coursesView = usePermissions('academic.courses').view;
  // Por año solo si además ve Cursos; si no, los de su carga (I2 de la 3e-2).
  const byYear = yearsView && coursesView;
  // Siempre un año: con «todos» no hay cursos que elegir (I2).
  const year = useYearFilter({ allowAll: false });
  const courseParam = useIdParam('course');
  const periodParam = useIdParam('period');
  const mine = useMyAssignments();
  const yearCourses = useCourseOptions(year.academicYearId, { enabled: byYear });

  // Sin años lectivos, los cursos de su carga (sin repetir).
  const mineCourses = [...new Map((mine.data ?? []).map((a) => [a.course.id, a.course])).values()];
  // Solo cursos del año elegido: mientras carga otro año, la lista anterior
  // (placeholderData) no valida un ?course= de ese año (B2 de la 3e-2).
  const courses: Course[] = byYear
    ? yearCourses.courses.filter((c) => c.academicYear.id === year.academicYearId)
    : mineCourses;
  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.name} · ${c.grade.name} · ${c.campus.name}`,
  }));
  const coursesPending = byYear ? year.isPending || yearCourses.isPending : mine.isPending;
  const courseChoice = pickOption(courseParam, courseOptions, coursesPending);
  const course = courses.find((c) => c.id === courseChoice.id);

  const periodsView = usePermissions('academic.periods');
  const yearId = course?.academicYear.id;
  const yearPeriods = usePeriods(periodsView.view ? yearId : undefined);
  const myPeriods = useMyPeriods({
    enabled: course !== undefined && !periodsView.isLoading && !periodsView.view,
  });
  const periods = periodsView.view
    ? (yearPeriods.data ?? [])
    : (myPeriods.data ?? []).filter((p) => p.academicYearId === yearId);
  const periodsPending = periodsView.view ? yearPeriods.isPending : myPeriods.isPending;
  const period = periods.find((p) => p.id === periodParam.id) ?? defaultPeriod(periods, today);

  const gradebook = useCourseGradebook(course?.id, period?.id);

  return (
    <>
      <ListToolbar>
        {byYear && <YearFilter filter={year} />}
        <SelectFilter
          label="Curso"
          value={courseChoice.value}
          options={courseOptions}
          onChange={courseParam.set}
          allLabel={
            coursesPending
              ? 'Cargando…'
              : courseOptions.length === 0
                ? 'No hay cursos'
                : 'Elige el curso'
          }
          className="sm:w-72"
        />
        {course && periods.length > 0 && (
          <SelectFilter
            label="Periodo"
            value={period?.id ?? ''}
            options={periods.map((p) => ({
              value: p.id,
              label: `${p.name} (${formatDay(p.startDate)} al ${formatDay(p.endDate)})`,
            }))}
            onChange={periodParam.set}
            allLabel={null}
            className="sm:w-96"
          />
        )}
      </ListToolbar>

      {!course ? (
        <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
          <p className="font-bold">
            {!coursesPending && courseOptions.length === 0
              ? 'No tienes cursos para consultar.'
              : 'Elige el curso para ver su cuadro de notas.'}
          </p>
        </div>
      ) : !periodsPending && periods.length === 0 ? (
        <Alert variant="info">
          {!periodsView.view && !mine.data?.some((a) => a.course.id === course.id)
            ? 'Para elegir el periodo necesitas también el permiso de ver Periodos.'
            : `El año lectivo ${String(course.academicYear.year)} todavía no tiene periodos.`}
        </Alert>
      ) : gradebook.isPending ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : gradebook.error ? (
        gradebook.error instanceof ApiError && gradebook.error.status === 404 ? (
          <Alert variant="info">No tienes notas que consultar en este curso.</Alert>
        ) : (
          <RetryAlert what="el cuadro de notas" onRetry={() => void gradebook.refetch()} />
        )
      ) : (
        <CourseTable data={gradebook.data} />
      )}
    </>
  );
}

/**
 * Estudiantes × materias. Desde tablet, tabla que se desplaza dentro de su
 * marco si no cabe (la página nunca); en celular, una tarjeta por estudiante.
 */
function CourseTable({ data }: { data: CourseGradebook }) {
  const { scale, subjects, students } = data;
  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
        <p className="font-bold">El curso no tiene estudiantes matriculados.</p>
      </div>
    );
  }
  const gradeOf = (row: CourseGradebook['students'][number], subjectId: string) =>
    row.subjects.find((g) => g.subjectId === subjectId);
  const name = (row: CourseGradebook['students'][number]) =>
    `${row.student.firstName} ${row.student.lastName}`;
  const label = `Notas del curso ${data.course.name} en ${data.period.name}`;

  return (
    <div className="flex flex-col gap-4">
      <GradesLegend scale={scale} />
      {subjects.length > 4 && (
        <p className="hidden text-sm text-muted-foreground md:block">
          Si no caben todas las materias, desplaza la tabla hacia los lados.
        </p>
      )}
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="relative hidden overflow-x-auto rounded-2xl border border-border bg-card outline-none focus-visible:ring-4 focus-visible:ring-ring/25 md:block"
      >
        <table className="w-full min-w-max border-separate border-spacing-0">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${HEAD} sticky left-0 z-10`}>
                Estudiante
              </th>
              {subjects.map((s) => (
                <th key={s.id} scope="col" className={HEAD}>
                  {s.name}
                </th>
              ))}
              <th scope="col" className={HEAD}>
                Promedio
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((row) => (
              <tr key={row.student.id}>
                <th scope="row" className={`${CELL} sticky left-0 z-10 bg-card font-bold`}>
                  <span className="block min-w-40">{name(row)}</span>
                  {row.enrollmentStatus !== 'ENROLLED' && (
                    <span className="mt-1 block">
                      <EnrollmentBadge status={row.enrollmentStatus} />
                    </span>
                  )}
                </th>
                {subjects.map((s) => (
                  <td key={s.id} className={CELL}>
                    <GradeCell grade={gradeOf(row, s.id)} />
                  </td>
                ))}
                <td className={CELL}>
                  <AverageScore value={row.average} scale={scale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={label} className="flex flex-col gap-3 md:hidden">
        {students.map((row) => (
          <li key={row.student.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold break-words">{name(row)}</span>
              {row.enrollmentStatus !== 'ENROLLED' && (
                <EnrollmentBadge status={row.enrollmentStatus} />
              )}
            </div>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
              {subjects.map((s) => (
                <div key={s.id} className="contents">
                  <dt className="min-w-0 break-words text-muted-foreground">{s.name}</dt>
                  <dd className="text-right">
                    <GradeCell grade={gradeOf(row, s.id)} />
                  </dd>
                </div>
              ))}
              <div className="contents">
                <dt className="font-bold">Promedio</dt>
                <dd className="text-right">
                  <AverageScore value={row.average} scale={scale} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RetryAlert({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Alert variant="error">
      No pudimos cargar {what}.{' '}
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

const HEAD =
  'border-b border-rule bg-muted px-4 py-3 text-left text-sm font-bold whitespace-nowrap text-muted-foreground';
const CELL = 'border-b border-border px-4 py-3 text-left align-top';
