import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type {
  CreateAcademicYearBody,
  CreateCourseBody,
  CreateEnrollmentBody,
  CreatePeriodBody,
  CreateTeacherAssignmentBody,
  EnrollmentStatus,
  PerformanceLevelInput,
  PerformanceLevels,
  UpdateAcademicYearBody,
  UpdateCourseBody,
  UpdateEnrollmentBody,
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

export function useCatalog(
  kind: CatalogKind,
  query: CatalogQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const key = [...useAcademicKey(), kind] as const;
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () =>
      unwrap(
        kind === 'grades'
          ? api.GET('/api/grades', { params: { query } })
          : api.GET('/api/subjects', { params: { query } }),
      ),
    enabled: enabled && typeof key[1] === 'string',
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

// ─── Cursos ────────────────────────────────────────────────────────────────

export type CourseQuery = {
  page: number;
  limit: number;
  search?: string;
  academicYearId?: string;
  gradeId?: string;
  campusId?: string;
};

export function useCourses(query: CourseQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const key = [...useAcademicKey(), 'courses'] as const;
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () => unwrap(api.GET('/api/courses', { params: { query } })),
    enabled: enabled && typeof key[1] === 'string',
    placeholderData: samePrefix(key),
  });
}

export function useCourse(id: string) {
  const key = [...useAcademicKey(), 'courses'] as const;
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: () => unwrap(api.GET('/api/courses/{id}', { params: { path: { id } } })),
    enabled: isUuid(id) && typeof key[1] === 'string',
  });
}

/**
 * Cursos, carga y matrículas se muestran unos dentro de otros (y en la lista
 * de estudiantes, filtrada por curso): un cambio recarga lo académico y Personas.
 */
function useInvalidateAcademicAndPeople() {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ['people'] });
  };
}

export function useSaveCourse() {
  const invalidate = useInvalidateAcademicAndPeople();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CreateCourseBody | UpdateCourseBody }) =>
      unwrap(
        id
          ? api.PATCH('/api/courses/{id}', { params: { path: { id } }, body })
          : api.POST('/api/courses', { body: body as CreateCourseBody }),
      ),
    onSuccess: invalidate,
  });
}

/** Como al eliminar un año: la ficha se quita después de salir de ella (`useForgetCourse`). */
export function useDeleteCourse() {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/courses/{id}', { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({
        queryKey: key,
        predicate: (query) => !(query.queryKey[2] === 'courses' && query.queryKey[4] === id),
      });
      void queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}

export function useForgetCourse() {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return (id: string) => {
    queryClient.removeQueries({ queryKey: [...key, 'courses', 'detail', id] });
  };
}

// ─── Carga académica ───────────────────────────────────────────────────────

export type AssignmentQuery = {
  page: number;
  limit: number;
  courseId?: string;
  subjectId?: string;
  teacherId?: string;
  academicYearId?: string;
  isActive?: boolean;
};

export function useTeacherAssignments(
  query: AssignmentQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const key = [...useAcademicKey(), 'teacher-assignments'] as const;
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () => unwrap(api.GET('/api/teacher-assignments', { params: { query } })),
    enabled: enabled && typeof key[1] === 'string',
    placeholderData: samePrefix(key),
  });
}

export function useCreateTeacherAssignment() {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: (body: CreateTeacherAssignmentBody) =>
      unwrap(api.POST('/api/teacher-assignments', { body })),
    onSuccess: invalidate,
  });
}

export function useReplaceTeacher() {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: ({ id, teacherId }: { id: string; teacherId: string }) =>
      unwrap(
        api.POST('/api/teacher-assignments/{id}/replace', {
          params: { path: { id } },
          body: { teacherId },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeactivateAssignment() {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.PATCH('/api/teacher-assignments/{id}/deactivate', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

export function useDeleteAssignment() {
  const invalidate = useInvalidateAcademic();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/teacher-assignments/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

// ─── Matrículas ────────────────────────────────────────────────────────────

export type EnrollmentQuery = {
  page: number;
  limit: number;
  search?: string;
  courseId?: string;
  academicYearId?: string;
  studentId?: string;
  status?: EnrollmentStatus;
};

/** Listados: sin observaciones (el backend solo las da en el detalle). */
export function useEnrollments(
  query: EnrollmentQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const key = [...useAcademicKey(), 'enrollments'] as const;
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () => unwrap(api.GET('/api/enrollments', { params: { query } })),
    enabled: enabled && typeof key[1] === 'string',
    placeholderData: samePrefix(key),
  });
}

/**
 * Detalle con las observaciones (texto libre sobre un menor): solo mientras el
 * diálogo de edición está abierto; no queda en la caché al cerrarlo.
 */
export function useEnrollment(id: string) {
  const key = [...useAcademicKey(), 'enrollments'] as const;
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: () => unwrap(api.GET('/api/enrollments/{id}', { params: { path: { id } } })),
    enabled: isUuid(id) && typeof key[1] === 'string',
    gcTime: 0,
  });
}

/**
 * Tras crear o editar una matrícula se recarga todo menos su detalle (con
 * las observaciones): se quita de la caché, así no se vuelve a pedir mientras
 * se cierra el diálogo (B3 de la 3d-2).
 */
function useRefreshAfterEnrollment() {
  const queryClient = useQueryClient();
  const key = useAcademicKey();
  return (enrollment: { id: string }) => {
    queryClient.removeQueries({ queryKey: [...key, 'enrollments', 'detail', enrollment.id] });
    void queryClient.invalidateQueries({
      queryKey: key,
      predicate: (query) =>
        !(query.queryKey[2] === 'enrollments' && query.queryKey[3] === 'detail'),
    });
    void queryClient.invalidateQueries({ queryKey: ['people'] });
  };
}

/** Lleva observaciones sobre un menor: gcTime 0, no quedan en la caché de mutaciones. */
export function useCreateEnrollment() {
  const invalidate = useRefreshAfterEnrollment();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: CreateEnrollmentBody) => unwrap(api.POST('/api/enrollments', { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateEnrollment() {
  const invalidate = useRefreshAfterEnrollment();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ id, body }: { id: string; body: UpdateEnrollmentBody }) =>
      unwrap(api.PATCH('/api/enrollments/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}
