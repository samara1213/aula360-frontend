import { Download, FileStack, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError, ERROR_CODES, errorMessage } from '@/api/errors';
import type { BatchReportCardsResult, Course, Period, ReportCard } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CoursePeriodContent,
  CoursePeriodToolbar,
  RetryAlert,
} from '@/features/evaluations/course-period';
import { useActiveRoles, useCoursePeriod } from '@/features/evaluations/course-period-state';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatDate, formatScore } from '@/lib/format';
import {
  useGenerateBatch,
  useGenerateReportCard,
  useMyReportCards,
  useReportCards,
} from './reports-api';
import { ReportCardStatus } from './report-card-status';
import { useDownload } from './use-download';

const studentName = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`;

/**
 * /reports/report-cards: el administrador genera y descarga los boletines de
 * un curso por periodo; el estudiante, los suyos. Quien es las dos cosas, en
 * pestañas (como en Notas: personal es quien ve Cursos).
 */
export function ReportCardsPage() {
  const isStudent = useActiveRoles().includes('STUDENT');
  const courses = usePermissions('academic.courses');
  const isStaff = !isStudent || courses.view;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Boletines"
        description={
          isStaff
            ? 'Genera los boletines de cada curso por periodo y descárgalos en PDF.'
            : 'Tus boletines de cada periodo, en PDF.'
        }
      />
      {courses.isLoading && isStudent ? (
        <Skeleton className="h-60 rounded-2xl" />
      ) : isStudent && isStaff ? (
        <Tabs defaultValue="course">
          <TabsList aria-label="Vistas de boletines">
            <TabsTrigger value="course">Boletines del curso</TabsTrigger>
            <TabsTrigger value="mine">Mis boletines</TabsTrigger>
          </TabsList>
          <TabsContent value="course" className="flex flex-col gap-6">
            <CourseReportCards />
          </TabsContent>
          <TabsContent value="mine">
            <MyReportCards />
          </TabsContent>
        </Tabs>
      ) : isStudent ? (
        <MyReportCards />
      ) : (
        <CourseReportCards />
      )}
    </div>
  );
}

/** Los boletines de un curso en un periodo, con la generación masiva. */
function CourseReportCards() {
  const state = useCoursePeriod({ ownLoad: false });
  const [params, setParams] = useSearchParams();
  const onlyOutdated = params.get('outdated') === '1';
  const can = usePermissions('reports.report-cards');

  return (
    <>
      <CoursePeriodToolbar state={state} />
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 self-start">
        <input
          type="checkbox"
          className="size-5 cursor-pointer accent-primary"
          checked={onlyOutdated}
          onChange={(e) => {
            setParams((prev) => {
              const next = new URLSearchParams(prev);
              if (e.target.checked) next.set('outdated', '1');
              else next.delete('outdated');
              return next;
            });
          }}
        />
        Solo los desactualizados
      </label>
      <CoursePeriodContent state={state} prompt="Elige el curso para ver sus boletines.">
        {(course, period) => (
          <CourseList
            key={`${course.id}:${period.id}`}
            course={course}
            period={period}
            onlyOutdated={onlyOutdated}
            canGenerate={can.create}
          />
        )}
      </CoursePeriodContent>
    </>
  );
}

function CourseList({
  course,
  period,
  onlyOutdated,
  canGenerate,
}: {
  course: Course;
  period: Period;
  onlyOutdated: boolean;
  canGenerate: boolean;
}) {
  // La lista vuelve a la primera página con otro filtro (CourseList se monta por curso y periodo).
  const [pageState, setPageState] = useState({ page: 1, onlyOutdated });
  const page = pageState.onlyOutdated === onlyOutdated ? pageState.page : 1;
  const { data, isPending, isFetching, error, refetch } = useReportCards({
    page,
    courseId: course.id,
    periodId: period.id,
    ...(onlyOutdated ? { outdated: true } : {}),
  });
  const { download, pending } = useDownload();
  const [batchOpen, setBatchOpen] = useState(false);
  const [summary, setSummary] = useState<BatchReportCardsResult | null>(null);
  const [regenerate, setRegenerate] = useState<ReportCard | null>(null);

  const columns: Column<ReportCard>[] = [
    { key: 'student', header: 'Estudiante', cell: (r) => studentName(r.student) },
    {
      key: 'average',
      header: 'Promedio',
      cell: (r) => <span className="tabular-nums">{formatScore(r.finalAverage)}</span>,
    },
    { key: 'generated', header: 'Generado', cell: (r) => formatDate(r.generatedAt) },
    { key: 'status', header: 'Estado', cell: (r) => <ReportCardStatus outdated={r.outdated} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-muted-foreground">
          Curso {course.name}, {period.name}. Un boletín desactualizado tiene notas que cambiaron
          después de generarlo: regenéralo.
        </p>
        {canGenerate && (
          <Button
            onClick={() => {
              setBatchOpen(true);
            }}
          >
            <FileStack aria-hidden="true" />
            Generar boletines del curso
          </Button>
        )}
      </div>
      {summary && (
        <BatchSummary
          summary={summary}
          onClose={() => {
            setSummary(null);
          }}
        />
      )}
      <DataList
        label={`Boletines de ${course.name} en ${period.name}`}
        columns={columns}
        rows={data?.data}
        getKey={(r) => r.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          <>
            <p className="font-bold">
              {onlyOutdated
                ? 'Ningún boletín está desactualizado.'
                : 'Este periodo todavía no tiene boletines.'}
            </p>
            {canGenerate && !onlyOutdated && (
              <p className="mt-1 text-muted-foreground">
                Genéralos con «Generar boletines del curso».
              </p>
            )}
          </>
        }
        actions={(r) => (
          <RowActions label={`Acciones del boletín de ${studentName(r.student)}`}>
            <DropdownMenuItem
              disabled={pending === r.id}
              onSelect={() => {
                download(r.id);
              }}
            >
              <Download aria-hidden="true" />
              Descargar
            </DropdownMenuItem>
            {canGenerate && (
              <DropdownMenuItem
                onSelect={() => {
                  setRegenerate(r);
                }}
              >
                <RefreshCw aria-hidden="true" />
                Regenerar
              </DropdownMenuItem>
            )}
          </RowActions>
        )}
      />
      <Pagination
        meta={data?.meta}
        noun="boletines"
        onPage={(next) => {
          setPageState({ page: next, onlyOutdated });
        }}
      />
      {batchOpen && (
        <BatchDialog
          course={course}
          period={period}
          onClose={() => {
            setBatchOpen(false);
          }}
          onDone={(result) => {
            setBatchOpen(false);
            setSummary(result);
          }}
        />
      )}
      {regenerate && (
        <RegenerateDialogs
          reportCard={regenerate}
          period={period}
          onClose={() => {
            setRegenerate(null);
          }}
        />
      )}
    </div>
  );
}

/** Confirmación de la generación masiva, con la opción de incluir pendientes. */
function BatchDialog({
  course,
  period,
  onClose,
  onDone,
}: {
  course: Course;
  period: Period;
  onClose: () => void;
  onDone: (result: BatchReportCardsResult) => void;
}) {
  const batch = useGenerateBatch();
  const [force, setForce] = useState(false);
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`¿Generar los boletines de ${course.name}?`}
      description={
        <span className="flex flex-col gap-4">
          <span>
            Se generan los de {period.name} de los estudiantes matriculados (no los retirados) con
            la plantilla activa de la institución. Los que ya existen se reemplazan. Puede tardar un
            par de minutos.
          </span>
          <label className="flex cursor-pointer items-start gap-3 text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
              checked={force}
              onChange={(e) => {
                setForce(e.target.checked);
              }}
            />
            <span>
              Incluir a quienes tienen materias sin definitiva (su promedio será parcial). Sin esta
              opción, se omiten.
            </span>
          </label>
        </span>
      }
      confirmLabel="Generar boletines"
      pendingLabel="Generando…"
      pending={batch.isPending}
      onConfirm={() => {
        batch.mutate(
          { courseId: course.id, periodId: period.id, ...(force ? { force } : {}) },
          {
            onSuccess: (result) => {
              toast.success(
                result.generated === 1
                  ? '1 boletín generado.'
                  : `${String(result.generated)} boletines generados.`,
              );
              onDone(result);
            },
            onError: (err) => {
              toast.error(errorMessage(err));
            },
          },
        );
      }}
    />
  );
}

/** Resumen de la generación masiva: a quién se omitió y por qué, y quién falló. */
function BatchSummary({
  summary,
  onClose,
}: {
  summary: BatchReportCardsResult;
  onClose: () => void;
}) {
  const clean = summary.skipped.length === 0 && summary.failed.length === 0;
  // Sin nombre: el lote se cortó porque quien lo pidió perdió el permiso (B3 de la 3f-1).
  const named = summary.failed.filter(
    (f): f is typeof f & { firstName: string; lastName: string } =>
      f.firstName !== undefined && f.lastName !== undefined,
  );
  const unnamed = summary.failed.length - named.length;
  return (
    <section
      aria-label="Resultado de la generación"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-bold">
          Se generaron {summary.generated} de {summary.total} boletines.
          {clean && ' Todos quedaron listos.'}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar resumen
        </Button>
      </div>
      {summary.skipped.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">Omitidos ({summary.skipped.length})</h3>
          <p className="text-sm text-muted-foreground">
            Para incluir a quienes tienen materias sin definitiva, genera de nuevo los del curso y
            marca «Incluir a quienes tienen materias sin definitiva».
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {summary.skipped.map((s) => (
              <li key={s.studentId}>
                <span className="font-bold">{studentName(s)}:</span> {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {named.length > 0 && (
        <Alert variant="error">
          No se pudieron generar los de {named.map((f) => studentName(f)).join(', ')}. Vuelve a
          generar los boletines del curso en unos minutos.
        </Alert>
      )}
      {unnamed > 0 && (
        <Alert variant="error">
          La generación se detuvo: ya no administras la sede de este curso. Quedaron {unnamed} sin
          generar.
        </Alert>
      )}
    </section>
  );
}

/**
 * Regenerar un boletín. Si le faltan definitivas, se explica y se ofrece
 * generarlo de todos modos (promedio parcial).
 */
function RegenerateDialogs({
  reportCard,
  period,
  onClose,
}: {
  reportCard: ReportCard;
  period: Period;
  onClose: () => void;
}) {
  const generate = useGenerateReportCard();
  const [pendingFinals, setPendingFinals] = useState<string | null>(null);
  const name = studentName(reportCard.student);
  const run = (force: boolean) => {
    generate.mutate(
      { studentId: reportCard.student.id, periodId: period.id, ...(force ? { force } : {}) },
      {
        onSuccess: () => {
          toast.success(`Boletín de ${name} generado.`);
          onClose();
        },
        onError: (err) => {
          if (
            !force &&
            err instanceof ApiError &&
            err.code === ERROR_CODES.REPORT_CARD_PENDING_FINALS
          ) {
            setPendingFinals(err.message);
            return;
          }
          toast.error(errorMessage(err));
          onClose();
        },
      },
    );
  };
  return pendingFinals === null ? (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`¿Regenerar el boletín de ${name}?`}
      description={`Se genera de nuevo con las notas de hoy y la plantilla activa, y reemplaza el de ${period.name}.`}
      confirmLabel="Regenerar boletín"
      pendingLabel="Generando…"
      pending={generate.isPending}
      onConfirm={() => {
        run(false);
      }}
    />
  ) : (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Faltan definitivas"
      description={`${pendingFinals}. El promedio del boletín será parcial.`}
      confirmLabel="Generar de todos modos"
      pendingLabel="Generando…"
      pending={generate.isPending}
      onConfirm={() => {
        run(true);
      }}
    />
  );
}

/** «Mis boletines» del estudiante. */
function MyReportCards() {
  const { data, isPending, error, refetch } = useMyReportCards();
  const { download, pending } = useDownload();
  if (isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <EmptyMine />;
    }
    return <RetryAlert what="tus boletines" onRetry={() => void refetch()} />;
  }
  if (data.length === 0) return <EmptyMine />;
  return (
    <ul aria-label="Mis boletines" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold break-words">{r.period.name}</p>
              <p className="text-sm text-muted-foreground">
                Curso {r.course.name} · generado el {formatDate(r.generatedAt)}
              </p>
            </div>
            <ReportCardStatus outdated={r.outdated} />
          </div>
          <p className="text-sm">
            Promedio <span className="font-bold tabular-nums">{formatScore(r.finalAverage)}</span>
          </p>
          {r.outdated && (
            <p className="text-sm text-muted-foreground">
              Tus notas cambiaron después de generarlo: la institución publicará una versión nueva.
            </p>
          )}
          <Button
            variant="outline"
            className="self-start"
            disabled={pending === r.id}
            onClick={() => {
              download(r.id);
            }}
          >
            <Download aria-hidden="true" />
            {pending === r.id ? 'Abriendo…' : 'Descargar PDF'}
            <span className="sr-only"> de {r.period.name}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function EmptyMine() {
  return (
    <div className="rounded-2xl border border-dashed border-rule bg-card px-6 py-10 text-center">
      <p className="font-bold">Todavía no tienes boletines.</p>
      <p className="mt-1 text-muted-foreground">
        Aparecerán aquí cuando la institución los genere al cerrar cada periodo.
      </p>
    </div>
  );
}
