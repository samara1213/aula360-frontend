import type { GradingScale, SubjectPeriodGrade } from '@/api/types';
import { formatScore } from '@/lib/format';
import { cn } from '@/lib/utils';

// Cómo se muestra una nota en los cuadros: la definitiva, o lo que falta para tenerla.

/** Definitiva con su estado (texto, no solo color); sin ella, el acumulado y las notas que faltan. */
export function GradeCell({ grade }: { grade: SubjectPeriodGrade | undefined }) {
  if (!grade || grade.evaluationCount === 0) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin evaluaciones</span>
      </span>
    );
  }
  if (grade.final !== null) return <FinalScore value={grade.final} passed={grade.passed} />;
  return (
    <span className="flex flex-col text-sm whitespace-nowrap text-muted-foreground">
      <span>
        Parcial <span className="tabular-nums">{formatScore(grade.accumulated)}</span>
      </span>
      <span>
        {grade.scoredCount} de {grade.evaluationCount} notas
        {grade.allocatedPercentage < 100 && `, ${String(grade.allocatedPercentage)} %`}
      </span>
    </span>
  );
}

/** Una nota final: por debajo de la mínima, resaltada y dicha en texto. */
export function FinalScore({ value, passed }: { value: number; passed: boolean | null }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold tabular-nums',
        passed === false && 'rounded-full bg-level-bajo px-2.5 py-0.5 text-level-bajo-foreground',
      )}
    >
      {formatScore(value)}
      {passed === false && <span className="text-sm font-bold">No aprueba</span>}
    </span>
  );
}

/** Promedio (sin definitivas, raya). */
export function AverageScore({
  value,
  scale,
}: {
  value: number | null | undefined;
  scale: GradingScale;
}) {
  if (value === null || value === undefined) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin promedio</span>
      </span>
    );
  }
  return <FinalScore value={value} passed={value >= scale.passingScore} />;
}

/** Explica cómo leer el cuadro. */
export function GradesLegend({ scale }: { scale: GradingScale }) {
  return (
    <p className="max-w-prose text-sm text-muted-foreground">
      La definitiva aparece cuando los porcentajes de la materia suman 100 y están todas las notas;
      mientras tanto se ve el parcial acumulado. Escala de {formatScore(scale.min)} a{' '}
      {formatScore(scale.max)}; se aprueba con {formatScore(scale.passingScore)}.
    </p>
  );
}
