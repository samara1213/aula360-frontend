import { useId, useState } from 'react';
import { ApiError } from '@/api/errors';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useYearChoices } from '@/features/academic/academic-api';
import { usePermissions } from '@/features/menu/menu';
import { useStudentGradebook } from './evaluations-api';
import { StudentGrades } from './student-grades';

/**
 * Notas de un estudiante en su ficha (Personas), con el permiso de ver
 * Notas. Sin elegir año, el activo más reciente en que está matriculado; con
 * el permiso de ver Años lectivos se puede elegir otro. Al docente el backend
 * solo le da sus materias.
 */
export function StudentGradesSection({ studentId }: { studentId: string }) {
  const selectId = useId();
  const canView = usePermissions('evaluations.scores').view;
  const canListYears = usePermissions('academic.years').view;
  const years = useYearChoices({ enabled: canView && canListYears });
  const [yearId, setYearId] = useState('');
  const { data, isPending, error, refetch } = useStudentGradebook(studentId, yearId || undefined, {
    enabled: canView,
  });
  if (!canView) return null;
  const yearRows = years.data?.data ?? [];

  return (
    <Section
      title="Notas"
      description="La definitiva de cada materia por periodo y la nota del año."
      actions={
        canListYears &&
        yearRows.length > 0 && (
          <div className="flex flex-col gap-2 sm:w-64">
            <Label htmlFor={selectId}>Año lectivo</Label>
            <NativeSelect
              id={selectId}
              value={yearId}
              onChange={(e) => {
                setYearId(e.target.value);
              }}
            >
              <option value="">El de su matrícula vigente</option>
              {yearRows.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year}
                </option>
              ))}
            </NativeSelect>
          </div>
        )
      }
    >
      {isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : error ? (
        error instanceof ApiError && error.status === 404 ? (
          <p className="text-muted-foreground">
            {yearId
              ? 'No hay notas que puedas ver de este estudiante en ese año.'
              : 'No hay notas que puedas ver de este estudiante: no tiene matrícula en un año activo o no le dictas materias.'}
          </p>
        ) : (
          <Alert variant="error">
            No pudimos cargar las notas.{' '}
            <button
              type="button"
              className="cursor-pointer font-bold text-primary underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </Alert>
        )
      ) : (
        <StudentGrades data={data} />
      )}
    </Section>
  );
}
