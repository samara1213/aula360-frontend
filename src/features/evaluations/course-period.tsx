import type { ReactNode } from 'react';
import type { Course, Period } from '@/api/types';
import { ListToolbar, SelectFilter } from '@/components/data/list-toolbar';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { YearFilter } from '@/features/academic/pickers';
import { formatDay } from '@/lib/format';
import type { CoursePeriod } from './course-period-state';

// Filtros de curso y periodo (estado en course-period-state.ts) y lo que va debajo.

export function CoursePeriodToolbar({ state }: { state: CoursePeriod }) {
  const { byYear, year, courseChoice, courseOptions, courseParam, coursesPending } = state;
  return (
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
      {state.course && state.periods.length > 0 && (
        <SelectFilter
          label="Periodo"
          value={state.period?.id ?? ''}
          options={state.periods.map((p) => ({
            value: p.id,
            label: `${p.name} (${formatDay(p.startDate)} al ${formatDay(p.endDate)})`,
          }))}
          onChange={state.periodParam.set}
          allLabel={null}
          className="sm:w-96"
        />
      )}
    </ListToolbar>
  );
}

/** Lo que va debajo de los filtros: qué falta elegir, o el contenido del curso y el periodo. */
export function CoursePeriodContent({
  state,
  prompt,
  children,
}: {
  state: CoursePeriod;
  /** «Elige el curso para ver…». */
  prompt: string;
  children: (course: Course, period: Period) => ReactNode;
}) {
  const { course, period } = state;
  if (!course) {
    return (
      <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
        <p className="font-bold">
          {!state.coursesPending && state.courseOptions.length === 0
            ? 'No tienes cursos para consultar.'
            : prompt}
        </p>
      </div>
    );
  }
  if (!state.periodsPending && state.periods.length === 0) {
    return (
      <Alert variant="info">
        {state.periodsForbidden
          ? 'Para elegir el periodo necesitas también el permiso de ver Periodos.'
          : `El año lectivo ${String(course.academicYear.year)} todavía no tiene periodos.`}
      </Alert>
    );
  }
  if (!period) return <Skeleton className="h-80 rounded-2xl" />;
  return children(course, period);
}

export function RetryAlert({ what, onRetry }: { what: string; onRetry: () => void }) {
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
