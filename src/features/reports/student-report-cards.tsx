import { Download } from 'lucide-react';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/menu/menu';
import { formatDate, formatScore } from '@/lib/format';
import { ReportCardStatus } from './report-card-status';
import { useReportCards } from './reports-api';
import { useDownload } from './use-download';

/**
 * Boletines de un estudiante en su ficha (Personas), con el permiso de ver
 * Boletines. El backend solo los da al administrador de la sede del curso.
 */
export function StudentReportCardsSection({ studentId }: { studentId: string }) {
  const canView = usePermissions('reports.report-cards').view;
  const { data, isPending, error, refetch } = useReportCards({ studentId }, { enabled: canView });
  const { download, pending } = useDownload();
  if (!canView) return null;
  const rows = data?.data ?? [];

  return (
    <Section title="Boletines" description="Los generados en cada periodo, en PDF.">
      {isPending ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : error ? (
        <Alert variant="error">
          No pudimos cargar los boletines.{' '}
          <button
            type="button"
            className="cursor-pointer font-bold text-primary underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </Alert>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No hay boletines que puedas ver de este estudiante.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-bold break-words">
                  {r.period.name} · Curso {r.course.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Promedio {formatScore(r.finalAverage)} · generado el {formatDate(r.generatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ReportCardStatus outdated={r.outdated} />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending === r.id}
                  aria-label={`Descargar el boletín de ${r.period.name}`}
                  onClick={() => {
                    download(r.id);
                  }}
                >
                  <Download aria-hidden="true" />
                  {pending === r.id ? 'Abriendo…' : 'Descargar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
