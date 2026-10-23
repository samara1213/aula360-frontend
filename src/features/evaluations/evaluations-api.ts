import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type {
  CreateEvaluationBody,
  EvaluationScores,
  ScoreEntry,
  UpdateEvaluationBody,
} from '@/api/types';
import { forSameSession, useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';

// Evaluaciones y notas de la institución activa (permisos `evaluations.*`).
// Todas las claves llevan la institución: los datos de una nunca se leen con otra.

function useEvaluationsKey() {
  const { data: session } = useSession();
  return ['evaluations', session?.activeInstitutionId] as const;
}

/** La carga activa del propio docente (sin permiso de menú: basta su perfil). */
export function useMyAssignments({ enabled = true }: { enabled?: boolean } = {}) {
  const key = useEvaluationsKey();
  return useQuery({
    queryKey: [...key, 'mine'],
    queryFn: () => unwrap(api.GET('/api/teacher-assignments/mine')),
    enabled: enabled && typeof key[1] === 'string',
  });
}

/** Periodos de los años en que el docente tiene carga activa (el rol TEACHER no ve /periods). */
export function useMyPeriods({ enabled = true }: { enabled?: boolean } = {}) {
  const key = useEvaluationsKey();
  return useQuery({
    queryKey: [...key, 'mine-periods'],
    queryFn: () => unwrap(api.GET('/api/teacher-assignments/mine/periods')),
    enabled: enabled && typeof key[1] === 'string',
  });
}

export type EvaluationQuery = { courseId: string; subjectId: string; periodId: string };

/**
 * Evaluaciones de una materia en un curso y un periodo (pocas: hasta 100),
 * de todas sus cargas visibles (también las del docente anterior).
 */
export function useEvaluations(query: EvaluationQuery | undefined) {
  const key = useEvaluationsKey();
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () =>
      unwrap(api.GET('/api/evaluations', { params: { query: { page: 1, limit: 100, ...query } } })),
    enabled: query !== undefined && typeof key[1] === 'string',
  });
}

/** Una evaluación cambia sus listados y las planillas: se recarga todo lo de evaluaciones. */
function useInvalidateEvaluations() {
  const queryClient = useQueryClient();
  const key = useEvaluationsKey();
  return () => void queryClient.invalidateQueries({ queryKey: key });
}

export function useSaveEvaluation() {
  const invalidate = useInvalidateEvaluations();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id?: string;
      body: CreateEvaluationBody | UpdateEvaluationBody;
    }) =>
      unwrap(
        id
          ? api.PATCH('/api/evaluations/{id}', { params: { path: { id } }, body })
          : api.POST('/api/evaluations', { body: body as CreateEvaluationBody }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteEvaluation() {
  const invalidate = useInvalidateEvaluations();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/evaluations/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

/**
 * Planilla de notas (nombres y notas de menores): gcTime 0, no queda en la
 * caché al salir de ella.
 */
export function useEvaluationScores(id: string) {
  const key = useEvaluationsKey();
  return useQuery({
    queryKey: [...key, 'scores', id],
    queryFn: () => unwrap(api.GET('/api/evaluations/{id}/scores', { params: { path: { id } } })),
    enabled: isUuid(id) && typeof key[1] === 'string',
    gcTime: 0,
  });
}

/**
 * Guarda un lote de notas (todo o nada). La respuesta trae las notas
 * guardadas: si la planilla sigue en la caché, las toma (así no se ven las
 * anteriores mientras recarga); después se recarga todo, también la
 * planilla, porque el permiso para escribir solo lo da el GET (B2 de la
 * 3e-1). Si mientras tanto cambió la sesión, la respuesta se descarta (M1 de
 * la 3e-1): son notas de menores de otra cuenta o institución.
 */
export function useSaveScores(id: string) {
  const queryClient = useQueryClient();
  const key = useEvaluationsKey();
  return useMutation({
    gcTime: 0,
    mutationFn: (scores: ScoreEntry[]) =>
      unwrap(
        api.PUT('/api/evaluations/{id}/scores', { params: { path: { id } }, body: { scores } }),
      ),
    ...forSameSession(queryClient, (data: EvaluationScores) => {
      const sheetKey = [...key, 'scores', id];
      // Solo si sigue en la caché: con gcTime 0 no se crea otra entrada.
      if (queryClient.getQueryData(sheetKey)) {
        queryClient.setQueryData<EvaluationScores>(
          sheetKey,
          (previous) => previous && { ...previous, students: data.students },
        );
      }
      void queryClient.invalidateQueries({ queryKey: key });
    }),
  });
}

// ─── Cuadro de notas (gradebook) ───────────────────────────────────────────
// Notas de menores: gcTime 0, no quedan en la caché al salir de la pantalla.
// staleTime corto: volver a la ventana o cambiar de pestaña no repite la
// consulta cada vez (límite de 60 por minuto; I3 de la 3e-2).
const GRADEBOOK_STALE_MS = 30_000;

/** Cuadro de un curso en un periodo (al docente, solo sus materias). */
export function useCourseGradebook(courseId: string | undefined, periodId: string | undefined) {
  const key = useEvaluationsKey();
  return useQuery({
    queryKey: [...key, 'gradebook', 'course', courseId, periodId],
    queryFn: () =>
      unwrap(
        api.GET('/api/gradebook/courses/{courseId}', {
          params: { path: { courseId: courseId ?? '' }, query: { periodId: periodId ?? '' } },
        }),
      ),
    enabled: courseId !== undefined && periodId !== undefined && typeof key[1] === 'string',
    gcTime: 0,
    staleTime: GRADEBOOK_STALE_MS,
  });
}

/**
 * Notas de un estudiante por año (sin año: el activo más reciente en que
 * está matriculado). Al docente, solo sus materias.
 */
export function useStudentGradebook(
  studentId: string,
  academicYearId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const key = useEvaluationsKey();
  return useQuery({
    queryKey: [...key, 'gradebook', 'student', studentId, academicYearId],
    queryFn: () =>
      unwrap(
        api.GET('/api/gradebook/students/{studentId}', {
          params: {
            path: { studentId },
            query: academicYearId ? { academicYearId } : {},
          },
        }),
      ),
    enabled: enabled && isUuid(studentId) && typeof key[1] === 'string',
    gcTime: 0,
    staleTime: GRADEBOOK_STALE_MS,
  });
}

/** Las notas del propio estudiante en su año activo. */
export function useMyGradebook({ enabled = true }: { enabled?: boolean } = {}) {
  const key = useEvaluationsKey();
  return useQuery({
    queryKey: [...key, 'gradebook', 'mine'],
    queryFn: () => unwrap(api.GET('/api/gradebook/mine')),
    enabled: enabled && typeof key[1] === 'string',
    gcTime: 0,
    staleTime: GRADEBOOK_STALE_MS,
  });
}
