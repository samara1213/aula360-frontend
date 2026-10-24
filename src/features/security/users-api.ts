import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type {
  CreateRoleAssignmentBody,
  CreateUserBody,
  ManagedUser,
  UpdateUserBody,
} from '@/api/types';
import { forSameSession, useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';

/**
 * Usuarios de la institución activa (`/users`, permiso `security.users`) o de
 * una institución cualquiera para el SUPER_ADMIN (`/institutions/:id/users`).
 */
export type UsersScope = { kind: 'institution' } | { kind: 'system'; institutionId: string };

export type UserListQuery = {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  roleId?: string;
  campusId?: string;
};

/** Con la institución en la clave: los usuarios de una nunca se leen con otra. */
function useUsersKey(scope: UsersScope) {
  const { data: session } = useSession();
  return scope.kind === 'system'
    ? (['admin', 'institution-users', scope.institutionId] as const)
    : (['users', session?.activeInstitutionId] as const);
}

const systemPath = (scope: Extract<UsersScope, { kind: 'system' }>) => ({
  institutionId: scope.institutionId,
});

export function useUsers(scope: UsersScope, query: UserListQuery) {
  const key = useUsersKey(scope);
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () =>
      unwrap(
        scope.kind === 'system'
          ? api.GET('/api/institutions/{institutionId}/users', {
              params: { path: systemPath(scope), query },
            })
          : api.GET('/api/users', { params: { query } }),
      ),
    placeholderData: (previous, previousQuery) =>
      key.every((part, i) => previousQuery?.queryKey[i] === part) ? previous : undefined,
  });
}

export function useUser(scope: UsersScope, id: string) {
  const key = useUsersKey(scope);
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: () =>
      unwrap(
        scope.kind === 'system'
          ? api.GET('/api/institutions/{institutionId}/users/{id}', {
              params: { path: { ...systemPath(scope), id } },
            })
          : api.GET('/api/users/{id}', { params: { path: { id } } }),
      ),
    enabled: validIds(scope, id),
  });
}

/** Guarda el detalle (sin la contraseña temporal) y recarga los listados. */
function useStoreUser(scope: UsersScope) {
  const queryClient = useQueryClient();
  const key = useUsersKey(scope);
  return forSameSession(queryClient, (response: ManagedUser & { temporaryPassword?: string }) => {
    const user = Object.fromEntries(
      Object.entries(response).filter(([field]) => field !== 'temporaryPassword'),
    ) as ManagedUser;
    queryClient.setQueryData([...key, 'detail', user.id], user);
    void queryClient.invalidateQueries({ queryKey: [...key, 'list'] });
  });
}

/**
 * La respuesta trae la contraseña temporal: quien llama la muestra una sola
 * vez y llama a reset(). gcTime 0: no queda en la caché de mutaciones.
 */
export function useCreateUser(scope: UsersScope) {
  const store = useStoreUser(scope);
  return useMutation({
    gcTime: 0,
    mutationFn: (body: CreateUserBody) =>
      unwrap(
        scope.kind === 'system'
          ? api.POST('/api/institutions/{institutionId}/users', {
              params: { path: systemPath(scope) },
              body,
            })
          : api.POST('/api/users', { body }),
      ),
    ...store,
  });
}

export function useUpdateUser(scope: UsersScope, id: string) {
  const store = useStoreUser(scope);
  return useMutation({
    // Lleva datos personales: no queda en la caché de mutaciones.
    gcTime: 0,
    mutationFn: (body: UpdateUserBody) =>
      unwrap(
        scope.kind === 'system'
          ? api.PATCH('/api/institutions/{institutionId}/users/{id}', {
              params: { path: { ...systemPath(scope), id } },
              body,
            })
          : api.PATCH('/api/users/{id}', { params: { path: { id } }, body }),
      ),
    ...store,
  });
}

export function useSetUserActive(scope: UsersScope, id: string) {
  const store = useStoreUser(scope);
  return useMutation({
    mutationFn: (isActive: boolean) =>
      unwrap(
        scope.kind === 'system'
          ? api.PATCH('/api/institutions/{institutionId}/users/{id}/status', {
              params: { path: { ...systemPath(scope), id } },
              body: { isActive },
            })
          : api.PATCH('/api/users/{id}/status', {
              params: { path: { id } },
              body: { isActive },
            }),
      ),
    ...store,
  });
}

/**
 * Quita el acceso a la institución activa a quien también está en otra: deja
 * de verse aquí y conserva su cuenta. Quien llama sale de su ficha.
 */
export function useRemoveInstitutionAccess(id: string) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    mutationFn: () =>
      unwrap(api.DELETE('/api/users/{id}/institution-access', { params: { path: { id } } })),
    onSuccess: () => {
      // Sus fichas (de usuario, docente o estudiante) ya no son de esta
      // institución: se quitan de la caché en vez de recargarlas (darían 404).
      queryClient.removeQueries({
        queryKey: ['users', session?.activeInstitutionId, 'detail', id],
      });
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === 'people' &&
          query.queryKey[3] === 'detail' &&
          (query.state.data as { user?: { id?: string } } | undefined)?.user?.id === id,
      });
      // Ya no está en los listados de usuarios ni de personas de esta institución.
      void queryClient.invalidateQueries({ queryKey: ['users', session?.activeInstitutionId] });
      void queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });
}

/** Contraseña temporal nueva: igual que al crear, se muestra una vez (gcTime 0). */
export function useResetTemporaryPassword(scope: UsersScope, id: string) {
  const queryClient = useQueryClient();
  const key = useUsersKey(scope);
  return useMutation({
    gcTime: 0,
    mutationFn: () =>
      unwrap(
        scope.kind === 'system'
          ? api.POST('/api/institutions/{institutionId}/users/{id}/temporary-password', {
              params: { path: { ...systemPath(scope), id } },
            })
          : api.POST('/api/users/{id}/temporary-password', { params: { path: { id } } }),
      ),
    // Ahora debe cambiarla al entrar.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...key, 'detail', id] }),
  });
}

// ─── Asignaciones de rol ───────────────────────────────────────────────────

/** Tras asignar o quitar: el usuario (trae sus asignaciones), los listados y las asignaciones. */
function useInvalidateAssignments(scope: UsersScope) {
  const queryClient = useQueryClient();
  const key = useUsersKey(scope);
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: assignmentsKey(scope) }),
    ]);
}

const assignmentsKey = (scope: UsersScope) =>
  scope.kind === 'system'
    ? (['admin', 'role-assignments', scope.institutionId] as const)
    : (['role-assignments'] as const);

/** Asignaciones de una institución (SUPER_ADMIN): pestaña «Asignaciones». */
export function useInstitutionAssignments(
  institutionId: string,
  query: { page: number; limit: number },
) {
  return useQuery({
    queryKey: [...assignmentsKey({ kind: 'system', institutionId }), query],
    queryFn: () =>
      unwrap(
        api.GET('/api/institutions/{institutionId}/role-assignments', {
          params: { path: { institutionId }, query },
        }),
      ),
  });
}

export function useCreateAssignment(scope: UsersScope) {
  const invalidate = useInvalidateAssignments(scope);
  return useMutation({
    mutationFn: (body: CreateRoleAssignmentBody) =>
      unwrap(
        scope.kind === 'system'
          ? api.POST('/api/institutions/{institutionId}/role-assignments', {
              params: { path: systemPath(scope) },
              body,
            })
          : api.POST('/api/role-assignments', { body }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteAssignment(scope: UsersScope) {
  const invalidate = useInvalidateAssignments(scope);
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        scope.kind === 'system'
          ? api.DELETE('/api/institutions/{institutionId}/role-assignments/{id}', {
              params: { path: { ...systemPath(scope), id } },
            })
          : api.DELETE('/api/role-assignments/{id}', { params: { path: { id } } }),
      ),
    onSuccess: invalidate,
  });
}

/**
 * Busca un usuario activo por correo o documento (SUPER_ADMIN, coincidencia
 * exacta). Es una mutación: se dispara al enviar, no al escribir.
 */
export function useLookupUser() {
  return useMutation({
    gcTime: 0,
    mutationFn: (query: { email: string } | { documentType: string; documentNumber: string }) =>
      unwrap(api.GET('/api/users/lookup', { params: { query } })),
  });
}

/** El id del usuario y, para el SUPER_ADMIN, el de la institución vienen de la URL. */
export function validIds(scope: UsersScope, id: string): boolean {
  return isUuid(id) && (scope.kind === 'institution' || isUuid(scope.institutionId));
}
