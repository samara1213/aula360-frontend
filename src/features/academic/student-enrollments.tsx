import { Link } from 'react-router';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/menu/menu';
import { formatDate } from '@/lib/format';
import { useEnrollments } from './academic-api';
import { EnrollmentBadge } from './enrollment-badge';

const coursePath = (id: string) => `/academic/courses/${encodeURIComponent(id)}`;

/**
 * Matrículas de un estudiante (una por año), en su ficha. Solo con el permiso
 * de ver Matrículas; los cursos enlazan a su ficha si se pueden ver.
 */
export function StudentEnrollments({ studentId }: { studentId: string }) {
  const canView = usePermissions('academic.enrollments').view;
  const canSeeCourses = usePermissions('academic.courses').view;
  const { data, isPending, error, refetch } = useEnrollments(
    { page: 1, limit: 20, studentId },
    { enabled: canView },
  );
  if (!canView) return null;

  return (
    <Section title="Matrículas" description="Una por año lectivo. Se gestionan en Académico.">
      {isPending ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : error ? (
        <Alert variant="error">
          No pudimos cargar las matrículas.{' '}
          <button
            type="button"
            className="cursor-pointer font-bold text-primary underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </Alert>
      ) : data.data.length === 0 ? (
        <p className="text-muted-foreground">Todavía no tiene matrículas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" aria-label="Matrículas">
          {data.data.map((enrollment) => (
            <li
              key={enrollment.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-bold">
                  {enrollment.academicYear.year} ·{' '}
                  {canSeeCourses ? (
                    <Link
                      to={coursePath(enrollment.course.id)}
                      className="rounded-md text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
                    >
                      Curso {enrollment.course.name}
                    </Link>
                  ) : (
                    `Curso ${enrollment.course.name}`
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {enrollment.course.grade.name} · {enrollment.course.campus.name} · desde el{' '}
                  {formatDate(enrollment.enrollmentDate)}
                </p>
              </div>
              <EnrollmentBadge status={enrollment.status} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
