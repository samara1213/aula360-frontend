import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useBlocker } from 'react-router';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/api/errors';
import type { EvaluationScores, ScoreStudent } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DetailPage } from '@/components/detail-page';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClasses } from '@/components/ui/input';
import { EnrollmentBadge } from '@/features/academic/enrollment-badge';
import { PageHeader } from '@/features/layout/page-header';
import { formatDay, formatPercent, formatScore } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { cn } from '@/lib/utils';
import { useEvaluationScores, useSaveScores } from './evaluations-api';
import { parseScore, rowErrors, scoreInput, splitPaste } from './score-rules';

/** Máximo de filas por lote (MAX_SCORES_BATCH del backend). */
const MAX_BATCH = 200;

const evaluationsPath = (data: EvaluationScores) => {
  const { evaluation } = data;
  const params = new URLSearchParams({
    assignment: evaluation.teacherAssignment.id,
    period: evaluation.period.id,
    course: evaluation.teacherAssignment.course.id,
  });
  return `/evaluations/evaluations?${params.toString()}`;
};

/** /evaluations/evaluations/:id/scores */
export function ScoreSheetPage({ id }: { id: string }) {
  const query = useEvaluationScores(id);
  return (
    <DetailPage
      back={{
        to: query.data ? evaluationsPath(query.data) : '/evaluations/evaluations',
        label: 'Evaluaciones',
      }}
      validId={isUuid(id)}
      query={query}
      noun="la planilla"
    >
      {(data) => <ScoreSheet key={data.evaluation.id} data={data} />}
    </DetailPage>
  );
}

type Row = ScoreStudent & {
  /** Lo escrito en la celda (o la nota guardada). */
  text: string;
  editable: boolean;
  /** Retirado con nota: el administrador solo puede quitarla. */
  clearable: boolean;
  changed: boolean;
  /** null: nota válida (o vacía). */
  error: string | null;
};

/**
 * Planilla de una evaluación: una fila por estudiante; se guardan juntas las
 * que cambiaron (todo o nada). Las notas se escriben solo a quien tiene
 * matrícula vigente; a un retirado, el administrador solo le quita la nota.
 */
function ScoreSheet({ data }: { data: EvaluationScores }) {
  const { evaluation, scale } = data;
  const save = useSaveScores(evaluation.id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Map<string, string>>(new Map());
  const [generalError, setGeneralError] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  // Sin el dato (no vino del GET), solo lectura: el permiso no se supone (B2 de la 3e-1).
  const locked =
    data.lockedReason === undefined
      ? 'No pudimos comprobar si puedes registrar notas.'
      : data.lockedReason;
  const rows: Row[] = data.students.map((student) => {
    const enrolled = student.enrollmentStatus === 'ENROLLED';
    const editable = locked === null && enrolled;
    const clearable =
      locked === null && Boolean(data.canAdminister) && !enrolled && student.score !== null;
    const text = drafts[student.studentId] ?? scoreInput(student.score);
    const parsed = parseScore(text, scale);
    const changed = parsed.ok && parsed.value !== student.score;
    return {
      ...student,
      text,
      editable,
      clearable,
      changed: (editable || clearable) && changed,
      error: parsed.ok ? (serverErrors.get(student.studentId) ?? null) : parsed.error,
    };
  });
  const editableIds = rows.filter((r) => r.editable).map((r) => r.studentId);
  const changed = rows.filter((r) => r.changed);
  const invalid = rows.filter((r) => r.error !== null && r.studentId in drafts);
  const dirty = changed.length > 0 || invalid.length > 0;
  const enrolled = rows.filter((r) => r.enrollmentStatus === 'ENROLLED');
  const graded = enrolled.filter((r) => r.score !== null).length;

  // Salir con cambios sin guardar: se pide confirmación (dentro de la app y al cerrar la pestaña).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);

  const setText = (studentId: string, text: string) => {
    setDrafts((prev) => ({ ...prev, [studentId]: text }));
    setServerErrors((prev) => {
      if (!prev.has(studentId)) return prev;
      const next = new Map(prev);
      next.delete(studentId);
      return next;
    });
  };

  const focusRow = (studentId: string, offset: number) => {
    const index = editableIds.indexOf(studentId) + offset;
    const target = editableIds[index];
    if (target) inputs.current.get(target)?.focus();
  };

  const onKeyDown = (studentId: string) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(studentId, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(studentId, -1);
    }
  };

  // Una columna pegada desde una hoja de cálculo llena esta fila y las siguientes.
  const onPaste = (studentId: string) => (event: ClipboardEvent<HTMLInputElement>) => {
    const values = splitPaste(event.clipboardData.getData('text'));
    if (values.length <= 1) return;
    event.preventDefault();
    const start = editableIds.indexOf(studentId);
    const targets = editableIds.slice(start, start + values.length);
    setDrafts((prev) => {
      const next = { ...prev };
      targets.forEach((id, i) => {
        next[id] = values[i] ?? '';
      });
      return next;
    });
    setServerErrors(new Map());
    const skipped = values.length - targets.length;
    toast.info(
      skipped > 0
        ? `Se pegaron ${String(targets.length)} notas; sobraron ${String(skipped)}.`
        : `Se pegaron ${String(targets.length)} notas.`,
    );
  };

  const discard = () => {
    setDrafts({});
    setServerErrors(new Map());
    setGeneralError(null);
  };

  const submit = () => {
    if (invalid.length > 0) {
      setGeneralError('Corrige las notas marcadas antes de guardar.');
      return;
    }
    if (changed.length > MAX_BATCH) {
      setGeneralError(
        `Se pueden guardar hasta ${String(MAX_BATCH)} notas a la vez. Guarda una parte y luego el resto.`,
      );
      return;
    }
    setGeneralError(null);
    const scores = changed.map((r) => ({
      studentId: r.studentId,
      score: (() => {
        const parsed = parseScore(r.text, scale);
        return parsed.ok ? parsed.value : null;
      })(),
    }));
    save.mutate(scores, {
      onSuccess: () => {
        setDrafts({});
        setServerErrors(new Map());
        toast.success(
          scores.length === 1 ? 'Nota guardada.' : `${String(scores.length)} notas guardadas.`,
        );
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 400) {
          const { byStudent, general } = rowErrors(err.messages);
          setServerErrors(byStudent);
          setGeneralError(
            byStudent.size > 0
              ? 'No se guardó ninguna nota: revisa las filas marcadas.'
              : (general[0] ?? errorMessage(err)),
          );
        } else {
          setGeneralError(errorMessage(err));
        }
      },
    });
  };

  const assignment = evaluation.teacherAssignment;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={evaluation.title}
        description={`${assignment.subject.name} en ${assignment.course.name}, ${evaluation.period.name}. Vale ${formatPercent(evaluation.percentage)} del periodo; fecha: ${formatDay(evaluation.evaluationDate)}.`}
      />
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Escala</dt>
          <dd className="font-bold">
            {formatScore(scale.min)} a {formatScore(scale.max)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Nota mínima para aprobar</dt>
          <dd className="font-bold">{formatScore(scale.passingScore)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Con nota</dt>
          <dd className="font-bold">
            {graded} de {enrolled.length} matriculados
          </dd>
        </div>
      </dl>
      {locked && <Alert variant="info">{locked} La planilla es de solo lectura.</Alert>}
      {generalError && <Alert variant="error">{generalError}</Alert>}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
          <p className="font-bold">El curso no tiene estudiantes matriculados.</p>
        </div>
      ) : (
        <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border bg-card">
          <caption className="sr-only">Notas de {evaluation.title}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-rule bg-muted/60 px-4 py-3 text-left text-sm font-bold text-muted-foreground"
              >
                Estudiante
              </th>
              <th
                scope="col"
                className="w-32 border-b border-rule bg-muted/60 px-4 py-3 text-left text-sm font-bold text-muted-foreground sm:w-56"
              >
                Nota
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ScoreRow
                key={row.studentId}
                row={row}
                inputRef={(node) => {
                  if (node) inputs.current.set(row.studentId, node);
                  else inputs.current.delete(row.studentId);
                }}
                onText={(text) => {
                  setText(row.studentId, text);
                }}
                onKeyDown={onKeyDown(row.studentId)}
                onPaste={onPaste(row.studentId)}
              />
            ))}
          </tbody>
        </table>
      )}

      {locked === null && rows.some((r) => r.editable || r.clearable) && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_-12px_30px_-18px_rgb(0_0_0/0.35)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" aria-live="polite">
            {changed.length === 0 && invalid.length === 0
              ? 'Sin cambios. Escribe las notas y guárdalas juntas.'
              : `${String(changed.length)} ${changed.length === 1 ? 'cambio' : 'cambios'} sin guardar${invalid.length > 0 ? `, ${String(invalid.length)} con error` : ''}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!dirty || save.isPending} onClick={discard}>
              Descartar cambios
            </Button>
            <Button disabled={changed.length === 0 || save.isPending} onClick={submit}>
              {save.isPending ? 'Guardando…' : 'Guardar notas'}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(next) => {
          if (!next) blocker.reset?.();
        }}
        title="¿Salir sin guardar las notas?"
        description="Las notas que escribiste y no guardaste se perderán."
        confirmLabel="Salir sin guardar"
        pendingLabel="Saliendo…"
        destructive
        pending={false}
        onConfirm={() => {
          blocker.proceed?.();
        }}
      />
    </div>
  );
}

function ScoreRow({
  row,
  inputRef,
  onText,
  onKeyDown,
  onPaste,
}: {
  row: Row;
  inputRef: (node: HTMLInputElement | null) => void;
  onText: (text: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}) {
  const name = `${row.firstName} ${row.lastName}`;
  const errorId = `score-error-${row.studentId}`;
  return (
    <tr className={cn('group', row.changed && 'bg-secondary/60')}>
      <th
        scope="row"
        className="border-b border-border px-4 py-3 text-left align-top font-bold group-last:border-b-0"
      >
        <span className="break-words">{name}</span>
        <span className="mt-1 flex flex-wrap gap-2 text-sm font-normal">
          {row.enrollmentStatus === null ? (
            <Badge variant="inactive">Ya no está en el curso</Badge>
          ) : (
            row.enrollmentStatus !== 'ENROLLED' && <EnrollmentBadge status={row.enrollmentStatus} />
          )}
          {row.changed && <span className="text-primary">Sin guardar</span>}
        </span>
      </th>
      <td className="border-b border-border px-4 py-3 align-top group-last:border-b-0">
        {row.editable ? (
          <>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label={`Nota de ${name}`}
              aria-invalid={row.error ? true : undefined}
              aria-describedby={row.error ? errorId : undefined}
              value={row.text}
              onChange={(e) => {
                onText(e.target.value);
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              className={cn(inputClasses, 'h-11 w-full max-w-28 text-right tabular-nums')}
            />
            {row.error && (
              <p id={errorId} className="mt-1.5 text-sm font-bold text-destructive">
                {row.error}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-1.5">
            <span className="tabular-nums">
              {row.changed ? (
                <>
                  <span className="text-muted-foreground line-through">
                    {row.score === null ? '' : formatScore(row.score)}
                  </span>{' '}
                  <span className="text-sm">Se quitará al guardar</span>
                </>
              ) : row.score === null ? (
                <span className="text-muted-foreground">Sin nota</span>
              ) : (
                formatScore(row.score)
              )}
            </span>
            {row.clearable && (
              <Button
                variant="link"
                size="sm"
                aria-label={`${row.changed ? 'Deshacer' : 'Quitar nota'} de ${name}`}
                onClick={() => {
                  onText(row.changed ? scoreInput(row.score) : '');
                }}
              >
                {row.changed ? 'Deshacer' : 'Quitar nota'}
              </Button>
            )}
            {row.error && <p className="text-sm font-bold text-destructive">{row.error}</p>}
          </div>
        )}
      </td>
    </tr>
  );
}
