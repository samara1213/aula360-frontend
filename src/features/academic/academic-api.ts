import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type {
  CreateAcademicYearBody,
  CreatePeriodBody,
  PerformanceLevelInput,
  PerformanceLevels,
  UpdateAcademicYearBody,
  UpdatePeriodBody,
} from '@/api/types';
import { forSameSession, useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';

// Académico de la institución activa (permisos `academic.*`). Todas las
// claves llevan la institución: los datos de una nunca se leen con otra.

function useAcademicKey() {
  const { data: session } = useSession();
  return ['academic', session?.activeInstitutionId] as const;
}

/** Datos anteriores mientras carga otra página, solo de la misma institución. */
function samePrefix(prefix: readonly unknown[]) {
  return <T>(previous: T | undefined, previousQuery?: { queryKey: readonly unknown[] }) =>
    prefix.every((part, i) => previousQuery?.queryKey[i] === part) ? previous : undefined;
}

// ─── Años lectivos ─────────────────────────────────────────────────────────

export type YearQuery = { page: number; limit: number; isActive?: boolean };

export function useAcademicYears(query: YearQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const key = [...useAcademicKey(), 'years'] as const;
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () => unwrap(api.GET('/api/academic-years', { params: { query } })),
    enabled: enabled && typeof key[1] === 'string',
    placeholderData: samePrefix(key),
  });
}

/**
 * Para selectores: los años de la institución (pocos), del más reciente al más
 * antiguo. `GET /academic-years` exige el permiso de ver Años lectivos: sin él
 * no se pide (B1 de la 3d-1).
 */
export function useYearChoices({ enabled = true }: { enabled?: boolean } = {}) {
  return useAcademicYears({ page: 1, limit: 100 }, { enabled });
}

export function useAcademicYear(id: string) {
  const key = [...useAcademicKey(), 'years'] as const;
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: () => unwrap(api.GET('/api/academic-years/{id}', { params: { path: { id } } })),
    enabled: isUuid(id) && typeof key[1] === 'string',
  });
}

/**
 * Un año cambia sus selectores y los cursos que dependen de él (3d-2): se
 * recarga todo lo académico de la institución.
 */
function useInvalidateAcademic() {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return () => void queryClient.invalidateQueries({ queryKey: key });
}

export function useCreateAcademicYear() {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: (body: CreateAcademicYearBody) => unwrap(api.POST('/api/academic-years', { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateAcademicYear() {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAcademicYearBody }) =>
      unwrap(api.PATCH('/api/academic-years/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/**
 * Al eliminar se recarga todo menos la ficha del año borrado: si se recargara
 * mientras está en pantalla, mostraría «no encontrado» antes de volver al
 * listado. Quien elimina la quita con `useForgetYear` después de salir de ella
 * (I2 de la 3d-1).
 */
export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/academic-years/{id}', { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: [...key, 'periods', id] });
      void queryClient.invalidateQueries({
        queryKey: key,
        predicate: (query) => !(query.queryKey[2] === 'years' && query.queryKey[4] === id),
      });
    },
  });
}

/** Quita de la caché la ficha de un año eliminado. */
export function useForgetYear() {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return (id: string) => {
    queryClient.removeQueries({ queryKey: [...key, 'years', 'detail', id] });
  };
}

// ─── Periodos ──────────────────────────────────────────────────────────────

/** Todos los periodos de un año (pocos: sin paginación), por fecha de inicio. */
export function usePeriods(yearId: string | undefined) {
  const key = useAcademicKey();
  return useQuery({
    queryKey: [...key, 'periods', yearId],
    queryFn: () =>
      unwrap(
        api.GET('/api/academic-years/{id}/periods', {
          params: { path: { id: yearId ?? '' } },
        }),
      ),
    enabled: yearId !== undefined && isUuid(yearId) && typeof key[1] === 'string',
  });
}

function useInvalidatePeriods(yearId: string) {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return () => void queryClient.invalidateQueries({ queryKey: [...key, 'periods', yearId] });
}

export function useCreatePeriod(yearId: string) {
  const invalidate = useInvalidatePeriods(yearId);
  return useMutation({
    mutationFn: (body: CreatePeriodBody) =>
      unwrap(
        api.POST('/api/academic-years/{id}/periods', { params: { path: { id: yearId } }, body }),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdatePeriod(yearId: string) {
  const invalidate = useInvalidatePeriods(yearId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePeriodBody }) =>
      unwrap(api.PATCH('/api/periods/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

export function useDeletePeriod(yearId: string) {
  const invalidate = useInvalidatePeriods(yearId);
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/periods/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

// ─── Grados y materias ─────────────────────────────────────────────────────

export type CatalogKind = 'grades' | 'subjects';
export type CatalogQuery = { page: number; limit: number; search?: string };

export function useCatalog(kind: CatalogKind, query: CatalogQuery) {
  const key = [...useAcademicKey(), kind] as const;
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () =>
      unwrap(
        kind === 'grades'
          ? api.GET('/api/grades', { params: { query } })
          : api.GET('/api/subjects', { params: { query } }),
      ),
    enabled: typeof key[1] === 'string',
    placeholderData: samePrefix(key),
  });
}

/** Un grado o una materia cambian los cursos y la carga que los muestran (3d-2). */
export function useSaveCatalogItem(kind: CatalogKind) {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) => {
      const body = { name };
      if (kind === 'grades') {
        return unwrap(
          id
            ? api.PATCH('/api/grades/{id}', { params: { path: { id } }, body })
            : api.POST('/api/grades', { body }),
        );
      }
      return unwrap(
        id
          ? api.PATCH('/api/subjects/{id}', { params: { path: { id } }, body })
          : api.POST('/api/subjects', { body }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCatalogItem(kind: CatalogKind) {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        kind === 'grades'
          ? api.DELETE('/api/grades/{id}', { params: { path: { id } } })
          : api.DELETE('/api/subjects/{id}', { params: { path: { id } } }),
      ),
    onSuccess: invalidate,
  });
}

// ─── Niveles de desempeño ──────────────────────────────────────────────────

export function usePerformanceLevels() {
  const key = [...useAcademicKey(), 'performance-levels'] as const;
  return useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.GET('/api/performance-levels')),
    enabled: typeof key[1] === 'string',
  });
}

/** Reemplaza el juego completo; la respuesta queda como los niveles vigentes. */
export function useReplacePerformanceLevels() {
  const queryClient = useQueryClient();
  const key = [...useAcademicKey(), 'performance-levels'] as const;
  return useMutation({
    mutationFn: (levels: PerformanceLevelInput[]) =>
      unwrap(api.PUT('/api/performance-levels', { body: { levels } })),
    ...forSameSession(queryClient, (data: PerformanceLevels) => {
      queryClient.setQueryData(key, data);
    }),
  });
}
