import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type { CreateRoleBody, RoleDetail, RolePermissionInput, UpdateRoleBody } from '@/api/types';
import { forSameSession, useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';

/**
 * Roles de la institución activa (`/roles`: los propios más los globales, que
 * ahí son de solo lectura) o roles globales del SUPER_ADMIN (`/global-roles`).
 */
export type RoleScope = 'institution' | 'global';

type ListQuery = { page: number; limit: number; search?: string };

/** Con la institución en la clave: los roles de una nunca se leen con otra. */
function useRolesKey(scope: RoleScope) {
  const { data: session } = useSession();
  return scope === 'global'
    ? (['admin', 'global-roles'] as const)
    : (['roles', session?.activeInstitutionId] as const);
}

export function useRoles(scope: RoleScope, query: ListQuery) {
  const key = useRolesKey(scope);
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: () =>
      unwrap(
        scope === 'global'
          ? api.GET('/api/global-roles', { params: { query } })
          : api.GET('/api/roles', { params: { query } }),
      ),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === key[1] ? previous : undefined,
  });
}

export function useRole(scope: RoleScope, id: string) {
  const key = useRolesKey(scope);
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: () => {
      const params = { params: { path: { id } } };
      return unwrap(
        scope === 'global'
          ? api.GET('/api/global-roles/{id}', params)
          : api.GET('/api/roles/{id}', params),
      );
    },
    enabled: isUuid(id),
  });
}

/**
 * Guarda el detalle que devuelve el backend y recarga los listados. Con
 * `menu`, también el menú propio (los permisos de un rol que el usuario tiene
 * pueden cambiar lo que ve).
 */
function useStoreRole(scope: RoleScope, { menu = false } = {}) {
  const queryClient = useQueryClient();
  const key = useRolesKey(scope);
  return forSameSession(queryClient, (role: RoleDetail) => {
    queryClient.setQueryData([...key, 'detail', role.id], role);
    void queryClient.invalidateQueries({ queryKey: [...key, 'list'] });
    if (menu) void queryClient.invalidateQueries({ queryKey: ['menu'] });
  });
}

export function useCreateRole(scope: RoleScope) {
  const store = useStoreRole(scope);
  return useMutation({
    mutationFn: (body: CreateRoleBody) =>
      unwrap(
        scope === 'global'
          ? api.POST('/api/global-roles', { body })
          : api.POST('/api/roles', { body }),
      ),
    ...store,
  });
}

export function useUpdateRole(scope: RoleScope, id: string) {
  const store = useStoreRole(scope);
  return useMutation({
    mutationFn: (body: UpdateRoleBody) => {
      const options = { params: { path: { id } }, body };
      return unwrap(
        scope === 'global'
          ? api.PATCH('/api/global-roles/{id}', options)
          : api.PATCH('/api/roles/{id}', options),
      );
    },
    ...store,
  });
}

export function useReplacePermissions(scope: RoleScope, id: string) {
  const store = useStoreRole(scope, { menu: true });
  return useMutation({
    mutationFn: (permissions: RolePermissionInput[]) => {
      const options = { params: { path: { id } }, body: { permissions } };
      return unwrap(
        scope === 'global'
          ? api.PUT('/api/global-roles/{id}/permissions', options)
          : api.PUT('/api/roles/{id}/permissions', options),
      );
    },
    ...store,
  });
}

export function useDeleteRole(scope: RoleScope) {
  const queryClient = useQueryClient();
  const key = useRolesKey(scope);
  return useMutation({
    mutationFn: (id: string) => {
      const params = { params: { path: { id } } };
      return unwrap(
        scope === 'global'
          ? api.DELETE('/api/global-roles/{id}', params)
          : api.DELETE('/api/roles/{id}', params),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...key, 'list'] }),
  });
}

/** Árbol completo de opciones de menú, con las inactivas (SUPER_ADMIN o `security.menu-options`). */
export function useMenuTree(enabled = true) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['menu-options', 'tree', session?.activeInstitutionId ?? null],
    queryFn: () => unwrap(api.GET('/api/menu-options')),
    enabled,
  });
}
