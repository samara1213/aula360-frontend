import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';

// Boletines de la institución activa (permiso `reports.report-cards`). Las
// claves llevan la institución. Listas con promedios de menores: gcTime 0.

function useReportsKey() {
  const { data: session } = useSession();
  return ['reports', session?.activeInstitutionId] as const;
}

export type ReportCardQuery = {
  page?: number;
  courseId?: string;
  periodId?: string;
  studentId?: string;
  outdated?: boolean;
};

/** Boletines generados, de a 100 por página (la masiva admite 60 por curso). */
export function useReportCards(
  query: ReportCardQuery | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const key = useReportsKey();
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () =>
      unwrap(
        api.GET('/api/report-cards', { params: { query: { page: 1, limit: 100, ...query } } }),
      ),
    enabled: enabled && query !== undefined && typeof key[1] === 'string',
    gcTime: 0,
  });
}

/** Los boletines del propio estudiante. */
export function useMyReportCards({ enabled = true }: { enabled?: boolean } = {}) {
  const key = useReportsKey();
  return useQuery({
    queryKey: [...key, 'mine'],
    queryFn: () => unwrap(api.GET('/api/report-cards/mine')),
    enabled: enabled && typeof key[1] === 'string',
    gcTime: 0,
  });
}

function useInvalidateReports() {
  const queryClient = useQueryClient();
  const key = useReportsKey();
  return () => void queryClient.invalidateQueries({ queryKey: key });
}

/** Genera o regenera el boletín de un estudiante en un periodo. */
export function useGenerateReportCard() {
  const invalidate = useInvalidateReports();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: { studentId: string; periodId: string; force?: boolean }) =>
      unwrap(api.POST('/api/report-cards', { body })),
    onSuccess: invalidate,
  });
}

/** Genera los boletines de un curso en un periodo; responde un resumen. */
export function useGenerateBatch() {
  const invalidate = useInvalidateReports();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: { courseId: string; periodId: string; force?: boolean }) =>
      unwrap(api.POST('/api/report-cards/batch', { body })),
    onSuccess: invalidate,
  });
}

/**
 * El PDF del boletín por el backend (sin caché: M1 de la 3f-1). Se pide en
 * cada descarga y no pasa por React Query.
 */
export async function reportCardPdf(id: string): Promise<Blob> {
  if (!isUuid(id)) throw new Error('Boletín inválido');
  return unwrap(
    api.GET('/api/report-cards/{id}/pdf', { params: { path: { id } }, parseAs: 'blob' }),
  );
}
