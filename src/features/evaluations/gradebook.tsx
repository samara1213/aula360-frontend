import { ApiError } from '@/api/errors';
import type { CourseGradebook } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnrollmentBadge } from '@/features/academic/enrollment-badge';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { CoursePeriodContent, CoursePeriodToolbar, RetryAlert } from './course-period';
import { useActiveRoles, useCoursePeriod } from './course-period-state';
import { useCourseGradebook, useMyAssignments, useMyGradebook } from './evaluations-api';
import { AverageScore, GradeCell, GradesLegend } from './grades';
import { StudentGrades } from './student-grades';

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

/** Cuadro de un curso en un periodo (el docente elige entre los cursos de su carga). */
function CourseGradebookView() {
  const state = useCoursePeriod({ ownLoad: true });
  const gradebook = useCourseGradebook(state.course?.id, state.period?.id);
  return (
    <>
      <CoursePeriodToolbar state={state} />
      <CoursePeriodContent state={state} prompt="Elige el curso para ver su cuadro de notas.">
        {() =>
          gradebook.isPending ? (
            <Skeleton className="h-80 rounded-2xl" />
          ) : gradebook.error ? (
            gradebook.error instanceof ApiError && gradebook.error.status === 404 ? (
              <Alert variant="info">No tienes notas que consultar en este curso.</Alert>
            ) : (
              <RetryAlert what="el cuadro de notas" onRetry={() => void gradebook.refetch()} />
            )
          ) : (
            <CourseTable data={gradebook.data} />
          )
        }
      </CoursePeriodContent>
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

const HEAD =
  'border-b border-rule bg-muted px-4 py-3 text-left text-sm font-bold whitespace-nowrap text-muted-foreground';
const CELL = 'border-b border-border px-4 py-3 text-left align-top';
