import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type {
  CreateStudentBody,
  CreateTeacherBody,
  Student,
  Teacher,
  UpdateStudentBody,
  UpdateTeacherBody,
} from '@/api/types';
import { forSameSession, useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';

/** Docentes y estudiantes de la institución activa (permisos `people.*`). */
export type PeopleQuery = {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  campusId?: string;
  /** Solo estudiantes: los matriculados en este curso (3d-2). */
  courseId?: string;
};

/** Con la institución en la clave: las personas de una nunca se leen con otra. */
function usePeopleKey(kind: 'teachers' | 'students') {
  const { data: session } = useSession();
  return ['people', kind, session?.activeInstitutionId] as const;
}

/**
 * Guarda la ficha que respondió el backend (sin la contraseña temporal, que se
 * muestra una sola vez) y recarga los listados.
 */
function useStorePerson(kind: 'teachers' | 'students') {
  const queryClient = useQueryClient();
  const key = usePeopleKey(kind);
  return forSameSession(
    queryClient,
    (response: (Teacher | Student) & { temporaryPassword?: string }) => {
      const person = Object.fromEntries(
        Object.entries(response).filter(([field]) => field !== 'temporaryPassword'),
      ) as Teacher | Student;
      queryClient.setQueryData([...key, 'detail', person.id], person);
      void queryClient.invalidateQueries({ queryKey: [...key, 'list'] });
    },
  );
}

/** Recargar la ficha y los listados (p. ej. tras activar o desactivar la cuenta). */
export function useRefreshPeople(kind: 'teachers' | 'students') {
  const queryClient = useQueryClient();
  const key = usePeopleKey(kind);
  return () => void queryClient.invalidateQueries({ queryKey: key });
}

/** Quitar de la caché la ficha de alguien que ya no se puede ver, y recargar los listados. */
export function useForgetPerson(kind: 'teachers' | 'students') {
  const queryClient = useQueryClient();
  const key = usePeopleKey(kind);
  return (id: string) => {
    queryClient.removeQueries({ queryKey: [...key, 'detail', id] });
    void queryClient.invalidateQueries({ queryKey: [...key, 'list'] });
  };
}

// ─── Docentes ──────────────────────────────────────────────────────────────

export function useTeachers(query: PeopleQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const key = usePeopleKey('teachers');
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () => unwrap(api.GET('/api/teachers', { params: { query } })),
    enabled: enabled && typeof key[2] === 'string',
    // Datos anteriores mientras carga otra página, solo de la misma institución.
    placeholderData: (previous, previousQuery) =>
      key.every((part, i) => previousQuery?.queryKey[i] === part) ? previous : undefined,
  });
}

export function useTeacher(id: string) {
  const key = usePeopleKey('teachers');
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: () => unwrap(api.GET('/api/teachers/{id}', { params: { path: { id } } })),
    enabled: isUuid(id) && typeof key[2] === 'string',
  });
}

/** La respuesta trae la contraseña temporal: gcTime 0, no queda en la caché de mutaciones. */
export function useCreateTeacher() {
  const store = useStorePerson('teachers');
  return useMutation({
    gcTime: 0,
    mutationFn: (body: CreateTeacherBody) => unwrap(api.POST('/api/teachers', { body })),
    ...store,
  });
}

export function useUpdateTeacher(id: string) {
  const store = useStorePerson('teachers');
  return useMutation({
    // Lleva datos personales (de menores, en estudiantes): no queda en la caché de mutaciones.
    gcTime: 0,
    mutationFn: (body: UpdateTeacherBody) =>
      unwrap(api.PATCH('/api/teachers/{id}', { params: { path: { id } }, body })),
    ...store,
  });
}

// ─── Estudiantes ───────────────────────────────────────────────────────────

export function useStudents(query: PeopleQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const key = usePeopleKey('students');
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () => unwrap(api.GET('/api/students', { params: { query } })),
    enabled: enabled && typeof key[2] === 'string',
    // Datos anteriores mientras carga otra página, solo de la misma institución.
    placeholderData: (previous, previousQuery) =>
      key.every((part, i) => previousQuery?.queryKey[i] === part) ? previous : undefined,
  });
}

export function useStudent(id: string) {
  const key = usePeopleKey('students');
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: () => unwrap(api.GET('/api/students/{id}', { params: { path: { id } } })),
    enabled: isUuid(id) && typeof key[2] === 'string',
  });
}

export function useCreateStudent() {
  const store = useStorePerson('students');
  return useMutation({
    gcTime: 0,
    mutationFn: (body: CreateStudentBody) => unwrap(api.POST('/api/students', { body })),
    ...store,
  });
}

export function useUpdateStudent(id: string) {
  const store = useStorePerson('students');
  return useMutation({
    // Lleva datos personales (de menores, en estudiantes): no queda en la caché de mutaciones.
    gcTime: 0,
    mutationFn: (body: UpdateStudentBody) =>
      unwrap(api.PATCH('/api/students/{id}', { params: { path: { id } }, body })),
    ...store,
  });
}
