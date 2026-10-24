import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import type { Evaluation, Period, TeacherAssignment } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, RowActions, type Column } from '@/components/data/data-list';
import { pickOption, useIdParam } from '@/components/data/list-params';
import { ListToolbar, SelectFilter } from '@/components/data/list-toolbar';
import { RowLink } from '@/components/data/row-link';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePeriods, useTeacherAssignments } from '@/features/academic/academic-api';
import { teacherName, useCourseOptions, useYearFilter } from '@/features/academic/options';
import { YearFilter } from '@/features/academic/pickers';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatDay, formatPercent, isDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useDeleteEvaluation,
  useEvaluations,
  useMyAssignments,
  useMyPeriods,
  useSaveEvaluation,
} from './evaluations-api';
import {
  defaultPeriod,
  parseDecimal,
  periodState,
  schoolToday,
  sumPercentages,
} from './score-rules';

const ASSIGNMENT_LABELS: readonly [string, string] = ['Vigente', 'Terminada'];

const scoreSheetPath = (id: string) => `/evaluations/evaluations/${encodeURIComponent(id)}/scores`;

type Open = { kind: 'create' } | { kind: 'edit' | 'delete'; evaluation: Evaluation } | null;

/**
 * Por qué el docente no puede crear, editar ni borrar evaluaciones de esta
 * carga en este periodo (el backend lo vuelve a validar). Quien administra
 * la carga académica puede siempre.
 */
function writeLock(
  assignment: TeacherAssignment,
  period: Period,
  today: string,
  manages: boolean,
): string | null {
  if (manages) return null;
  if (!assignment.isActive) {
    return 'Esta carga terminó: solo la administración puede cambiar sus evaluaciones.';
  }
  if (!assignment.course.academicYear.isActive) {
    return 'El año lectivo está inactivo: solo la administración puede cambiar sus evaluaciones.';
  }
  if (periodState(period, today) === 'ended') {
    return 'El periodo ya terminó: solo la administración puede cambiar sus evaluaciones.';
  }
  return null;
}

/**
 * /evaluations/evaluations: las evaluaciones de una carga (materia + curso)
 * en un periodo. El docente elige entre sus cargas; quien ve la carga
 * académica, por año, curso y materia. Filtros en la URL (`?assignment=`,
 * `?period=`, `?course=`, `?year=`), aplicados solo si están entre las opciones.
 */
export function EvaluationsPage() {
  const today = schoolToday();
  const loads = usePermissions('academic.teacher-assignments');
  const assignmentParam = useIdParam('assignment');
  const periodParam = useIdParam('period');
  const courseParam = useIdParam('course');

  const mine = useMyAssignments();
  const year = useYearFilter();
  const courses = useCourseOptions(year.academicYearId, { enabled: loads.view });
  const courseChoice = pickOption(courseParam, courses.options, courses.isPending);
  const courseLoads = useTeacherAssignments(
    {
      page: 1,
      limit: 100,
      isActive: true,
      ...(courseChoice.id ? { courseId: courseChoice.id } : {}),
    },
    { enabled: loads.view && courseChoice.id !== undefined },
  );
  const mineRows = mine.data ?? [];
  const loadRows = courseChoice.id ? (courseLoads.data?.data ?? []) : [];
  const known = [...mineRows, ...loadRows];
  const choice = pickOption(
    assignmentParam,
    known.map((a) => ({ value: a.id })),
    mine.isPending ||
      courseChoice.pending ||
      (courseChoice.id !== undefined && courseLoads.isPending),
  );
  const selected = known.find((a) => a.id === choice.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Evaluaciones"
        description="Las evaluaciones de cada materia por periodo. Cuando sus porcentajes suman 100 y todas tienen nota, la materia tiene definitiva."
      />
      {mine.isError && (
        <Alert variant="error">No pudimos cargar tus cargas. {errorMessage(mine.error)}</Alert>
      )}
      {mineRows.length > 0 && (
        <MyAssignments rows={mineRows} selectedId={selected?.id} onSelect={assignmentParam.set} />
      )}
      {loads.view && (
        <ListToolbar>
          <YearFilter filter={year} />
          <SelectFilter
            label="Curso"
            value={courseChoice.value}
            options={courses.options}
            onChange={courseParam.set}
            allLabel={courses.options.length === 0 ? 'No hay cursos' : 'Elige el curso'}
          />
          {courseChoice.id && (
            <SelectFilter
              label="Materia"
              value={loadRows.some((a) => a.id === choice.id) ? choice.value : ''}
              options={loadRows.map((a) => ({
                value: a.id,
                label: `${a.subject.name} · ${teacherName(a.teacher)}`,
              }))}
              onChange={assignmentParam.set}
              allLabel={
                courseLoads.isPending
                  ? 'Cargando…'
                  : loadRows.length === 0
                    ? 'Sin materias asignadas'
                    : 'Elige la materia'
              }
              className="sm:w-72"
            />
          )}
        </ListToolbar>
      )}
      {selected ? (
        <AssignmentEvaluations
          key={selected.id}
          assignment={selected}
          periodParam={periodParam}
          own={mineRows.some((a) => a.id === selected.id)}
          today={today}
        />
      ) : mine.isPending && !loads.view ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
          {mineRows.length > 0 || loads.view ? (
            <p className="font-bold">
              {mineRows.length > 0
                ? 'Elige una de tus cargas para ver sus evaluaciones.'
                : 'Elige el curso y la materia para ver sus evaluaciones.'}
            </p>
          ) : (
            <>
              <p className="font-bold">No tienes carga académica activa.</p>
              <p className="mt-1 text-muted-foreground">
                Si dictas alguna materia este año, pide a la administración que te la asigne.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Las cargas activas del docente: una tarjeta por materia y curso. */
function MyAssignments({
  rows,
  selectedId,
  onSelect,
}: {
  rows: readonly TeacherAssignment[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-labelledby="my-assignments" className="flex flex-col gap-3">
      <h2 id="my-assignments" className="text-xl font-extrabold tracking-tight">
        Mis cargas
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((a) => {
          const active = a.id === selectedId;
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelect(a.id);
                }}
                className={cn(
                  'flex h-full w-full cursor-pointer flex-col items-start gap-1 rounded-2xl border bg-card p-4 text-left transition-[border-color,background-color] outline-none hover:border-primary focus-visible:ring-4 focus-visible:ring-ring/25',
                  active ? 'border-2 border-primary bg-secondary' : 'border-border',
                )}
              >
                <span className="font-bold break-words">{a.subject.name}</span>
                <span className="text-sm text-muted-foreground">
                  Curso {a.course.name} · {a.course.grade.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {a.course.campus.name} · {String(a.course.academicYear.year)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Evaluaciones de la carga elegida en un periodo, con la suma de porcentajes. */
function AssignmentEvaluations({
  assignment,
  periodParam,
  own,
  today,
}: {
  assignment: TeacherAssignment;
  periodParam: ReturnType<typeof useIdParam>;
  /** Es una de las cargas del propio docente (/mine). */
  own: boolean;
  today: string;
}) {
  const yearId = assignment.course.academicYear.id;
  const periodsAccess = usePermissions('academic.periods');
  const canListPeriods = periodsAccess.view;
  const yearPeriods = usePeriods(canListPeriods ? yearId : undefined);
  const myPeriods = useMyPeriods({ enabled: !periodsAccess.isLoading && !canListPeriods });
  const periodRows = canListPeriods
    ? (yearPeriods.data ?? [])
    : (myPeriods.data ?? []).filter((p) => p.academicYearId === yearId);
  const periodsPending = canListPeriods ? yearPeriods.isPending : myPeriods.isPending;
  const period =
    periodRows.find((p) => p.id === periodParam.id) ?? defaultPeriod(periodRows, today);

  const evaluationsQuery = useEvaluations(
    period
      ? { courseId: assignment.course.id, subjectId: assignment.subject.id, periodId: period.id }
      : undefined,
  );
  const rows = evaluationsQuery.data?.data;
  const total = sumPercentages(rows ?? []);
  const perms = usePermissions('evaluations.evaluations');
  const canOpenSheet = usePermissions('evaluations.scores').view;
  // Si administra las evaluaciones de la sede del curso lo dice el backend (B1 de la 3e-1).
  const manages = evaluationsQuery.data?.canAdminister ?? false;
  const lock =
    period && evaluationsQuery.data ? writeLock(assignment, period, today, manages) : null;
  const canTouch = (e: Evaluation) =>
    lock === null && (manages || e.teacherAssignment.id === assignment.id);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  const columns: Column<Evaluation>[] = [
    {
      key: 'title',
      header: 'Evaluación',
      cell: (e) => (
        <>
          {e.title}
          {e.teacherAssignment.id !== assignment.id && (
            <span className="block text-sm font-normal text-muted-foreground">
              De {teacherName(e.teacherAssignment.teacher)} (carga anterior)
            </span>
          )}
        </>
      ),
    },
    { key: 'date', header: 'Fecha', cell: (e) => formatDay(e.evaluationDate) },
    { key: 'percentage', header: 'Porcentaje', cell: (e) => formatPercent(e.percentage) },
    ...(canOpenSheet
      ? [
          {
            key: 'scores',
            header: 'Notas',
            cell: (e: Evaluation) => (
              <RowLink to={scoreSheetPath(e.id)}>
                <span aria-hidden="true">Abrir planilla</span>
                <span className="sr-only">Planilla de notas de {e.title}</span>
              </RowLink>
            ),
          },
        ]
      : []),
  ];

  const newButton = perms.create && period && evaluationsQuery.data && lock === null && (
    <Button
      onClick={() => {
        setOpen({ kind: 'create' });
      }}
    >
      <Plus aria-hidden="true" />
      Nueva evaluación
    </Button>
  );

  return (
    <section
      aria-labelledby="assignment-title"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="assignment-title" className="text-xl font-extrabold tracking-tight">
            {assignment.subject.name} en {assignment.course.name}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {assignment.course.grade.name} · {assignment.course.campus.name} · Docente:{' '}
            {teacherName(assignment.teacher)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!assignment.isActive && <StatusBadge active={false} labels={ASSIGNMENT_LABELS} />}
          {newButton}
        </div>
      </div>

      {!periodsPending && periodRows.length === 0 ? (
        <Alert variant="info">
          {!canListPeriods && !periodsAccess.isLoading && myPeriods.isSuccess && !own
            ? 'Para elegir el periodo necesitas también el permiso de ver Periodos.'
            : `El año lectivo ${String(assignment.course.academicYear.year)} todavía no tiene periodos.`}
        </Alert>
      ) : (
        <div className="flex flex-col gap-5 md:flex-row md:items-end">
          {periodsPending ? (
            <Skeleton className="h-[76px] w-full rounded-xl md:w-64" />
          ) : (
            <SelectFilter
              label="Periodo"
              value={period?.id ?? ''}
              options={periodRows.map((p) => ({
                value: p.id,
                label: `${p.name} (${formatDay(p.startDate)} al ${formatDay(p.endDate)})`,
              }))}
              onChange={periodParam.set}
              allLabel={null}
              className="md:w-96"
            />
          )}
          {rows && <PercentageMeter total={total} />}
        </div>
      )}

      {lock && <Alert variant="info">{lock}</Alert>}

      {period && (
        <DataList
          label={`Evaluaciones de ${assignment.subject.name} en ${period.name}`}
          columns={columns}
          rows={rows}
          getKey={(e) => e.id}
          isPending={evaluationsQuery.isPending}
          isFetching={evaluationsQuery.isFetching}
          error={evaluationsQuery.error}
          onRetry={() => void evaluationsQuery.refetch()}
          empty={
            <>
              <p className="font-bold">Este periodo todavía no tiene evaluaciones.</p>
              {newButton && (
                <p className="mt-1 text-muted-foreground">
                  Crea la primera con «Nueva evaluación».
                </p>
              )}
            </>
          }
          actions={
            perms.update || perms.delete
              ? (e) =>
                  canTouch(e) ? (
                    <RowActions label={`Acciones de ${e.title}`}>
                      {perms.update && (
                        <DropdownMenuItem
                          onSelect={() => {
                            setOpen({ kind: 'edit', evaluation: e });
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {perms.delete && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setOpen({ kind: 'delete', evaluation: e });
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </RowActions>
                  ) : null
              : undefined
          }
        />
      )}

      {period && rows && (
        <EvaluationDialogs
          open={open}
          onClose={close}
          assignment={assignment}
          period={period}
          evaluations={rows}
        />
      )}
    </section>
  );
}

/** Barra de la suma de porcentajes del periodo (100 = completo). */
function PercentageMeter({ total }: { total: number }) {
  const complete = total === 100;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span id="percentage-label" className="font-bold">
          Porcentaje asignado
        </span>
        <span>{formatPercent(total)} de 100 %</span>
      </div>
      <div
        role="meter"
        aria-labelledby="percentage-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={total}
        aria-valuetext={`${formatPercent(total)} de 100 %`}
        className="h-3 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full', complete ? 'bg-success' : 'bg-primary')}
          style={{ width: `${String(Math.min(total, 100))}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {complete
          ? 'Completo: con todas las notas, la materia tendrá definitiva en este periodo.'
          : `Faltan ${formatPercent(Math.round((100 - total) * 100) / 100)} para completar el periodo.`}
      </p>
    </div>
  );
}

function EvaluationDialogs({
  open,
  onClose,
  assignment,
  period,
  evaluations,
}: {
  open: Open;
  onClose: () => void;
  assignment: TeacherAssignment;
  period: Period;
  evaluations: readonly Evaluation[];
}) {
  const remove = useDeleteEvaluation();
  return (
    <>
      <Dialog
        open={open?.kind === 'create' || open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {(open?.kind === 'create' || open?.kind === 'edit') && (
          <EvaluationFormDialog
            key={open.kind === 'edit' ? open.evaluation.id : 'new'}
            assignment={assignment}
            period={period}
            evaluations={evaluations}
            evaluation={open.kind === 'edit' ? open.evaluation : undefined}
            onDone={onClose}
          />
        )}
      </Dialog>
      {open?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          title={`¿Eliminar «${open.evaluation.title}»?`}
          description="Solo se puede eliminar si todavía no tiene notas. Su porcentaje vuelve a quedar disponible en el periodo."
          confirmLabel="Eliminar evaluación"
          pendingLabel="Eliminando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(open.evaluation.id, {
              onSuccess: () => {
                toast.success('Evaluación eliminada.');
                onClose();
              },
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        />
      )}
    </>
  );
}

type FormValues = { title: string; percentage: string; evaluationDate: string };

const FORM_ID = 'evaluation-form';

function evaluationSchema(period: Period, available: number) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, 'Escribe el título.')
        .max(200, 'Escribe máximo 200 caracteres.'),
      percentage: z.string(),
      evaluationDate: z.string().refine(isDay, 'Elige una fecha válida.'),
    })
    .superRefine(({ percentage, evaluationDate }, ctx) => {
      const value = parseDecimal(percentage);
      const issue = (path: keyof FormValues, message: string) => {
        ctx.addIssue({ code: 'custom', path: [path], message });
      };
      if (value === undefined) {
        issue('percentage', 'Escribe un número con hasta 2 decimales, por ejemplo 20 o 12,5.');
      } else if (value <= 0) {
        issue('percentage', 'Debe ser mayor que 0.');
      } else if (value > available) {
        issue(
          'percentage',
          available > 0
            ? `Solo queda ${formatPercent(available)} disponible en este periodo.`
            : 'Este periodo ya tiene el 100 % asignado.',
        );
      }
      if (
        isDay(evaluationDate) &&
        (evaluationDate < period.startDate || evaluationDate > period.endDate)
      ) {
        issue(
          'evaluationDate',
          `Debe estar dentro del periodo, del ${formatDay(period.startDate)} al ${formatDay(period.endDate)}.`,
        );
      }
    });
}

/** Crear (sin `evaluation`) o editar una evaluación. Solo envía lo que cambió. */
function EvaluationFormDialog({
  assignment,
  period,
  evaluations,
  evaluation,
  onDone,
}: {
  assignment: TeacherAssignment;
  period: Period;
  evaluations: readonly Evaluation[];
  evaluation?: Evaluation;
  onDone: () => void;
}) {
  const save = useSaveEvaluation();
  const others = evaluations.filter((e) => e.id !== evaluation?.id);
  const available = Math.round((100 - sumPercentages(others)) * 100) / 100;
  const form = useForm<FormValues>({
    resolver: zodResolver(evaluationSchema(period, available)),
    defaultValues: {
      title: evaluation?.title ?? '',
      percentage: evaluation ? String(evaluation.percentage).replace('.', ',') : '',
      evaluationDate: evaluation?.evaluationDate ?? '',
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const next = {
      title: values.title.trim(),
      percentage: parseDecimal(values.percentage) ?? 0,
      evaluationDate: values.evaluationDate,
    };
    const options = {
      onSuccess: () => {
        toast.success(evaluation ? 'Evaluación guardada.' : `«${next.title}» creada.`);
        onDone();
      },
    };
    if (evaluation) {
      const body = Object.fromEntries(
        Object.entries(next).filter(
          ([field, value]) => evaluation[field as keyof Evaluation] !== value,
        ),
      );
      if (Object.keys(body).length === 0) {
        onDone();
        return;
      }
      save.mutate({ id: evaluation.id, body }, options);
    } else {
      save.mutate(
        { body: { ...next, teacherAssignmentId: assignment.id, periodId: period.id } },
        options,
      );
    }
  });

  return (
    <DialogContent
      title={evaluation ? 'Editar evaluación' : 'Nueva evaluación'}
      description={`${assignment.subject.name} en ${assignment.course.name}, ${period.name}.`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : evaluation ? 'Guardar cambios' : 'Crear evaluación'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5"
      >
        {save.isError && <Alert variant="error">{errorMessage(save.error)}</Alert>}
        <Field label="Título" error={errors.title?.message}>
          {(control) => (
            <Input
              autoComplete="off"
              placeholder="Taller 1"
              maxLength={200}
              {...control}
              {...form.register('title')}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Porcentaje"
            error={errors.percentage?.message}
            hint={`Disponible: ${formatPercent(Math.max(available, 0))}.`}
          >
            {(control) => (
              <Input
                inputMode="decimal"
                autoComplete="off"
                placeholder="20"
                {...control}
                {...form.register('percentage')}
              />
            )}
          </Field>
          <Field label="Fecha" error={errors.evaluationDate?.message}>
            {(control) => (
              <Input
                type="date"
                min={period.startDate}
                max={period.endDate}
                {...control}
                {...form.register('evaluationDate')}
              />
            )}
          </Field>
        </div>
      </form>
    </DialogContent>
  );
}
