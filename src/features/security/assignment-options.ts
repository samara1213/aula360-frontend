import { useCampuses } from '@/features/institution/institution-api';
import { usePermissions } from '@/features/menu/menu';
import { roleLabel } from '@/lib/roles';
import { useRoles } from './roles-api';
import type { UsersScope } from './users-api';

// Una institución tiene pocos roles y sedes: la primera página (máximo del backend) basta.
const ALL_ROWS = { page: 1, limit: 100 } as const;

export type Option = { value: string; label: string };

/**
 * Roles y sedes que se pueden elegir al crear un usuario o asignar un rol.
 * - Institución activa: los roles propios y los globales, y sus sedes activas.
 *   «Toda la institución» solo si quien asigna tiene el permiso en toda ella
 *   (el backend responde 403 a un alcance de sede).
 * - SUPER_ADMIN en otra institución: solo los roles globales y en toda la
 *   institución (no hay endpoints para listar los roles y sedes de otra).
 */
export function useAssignmentOptions(scope: UsersScope) {
  const system = scope.kind === 'system';
  const roles = useRoles(system ? 'global' : 'institution', ALL_ROWS);
  const campuses = useCampuses({ ...ALL_ROWS, isActive: true }, { enabled: !system });
  const wide = usePermissions('security.users').institutionWide;

  const roleOptions: Option[] = (roles.data?.data ?? []).map((role) => ({
    value: role.id,
    label: roleLabel(role),
  }));
  const campusOptions: Option[] = system
    ? []
    : (campuses.data?.data ?? []).map((campus) => ({ value: campus.id, label: campus.name }));

  return {
    roles: roleOptions,
    campuses: campusOptions,
    /** Se puede dejar sin sede (toda la institución). */
    allowWholeInstitution: system || wide.create,
    /** Se pueden crear administradores (exige alcance en toda la institución). */
    canCreateAdmins: system || wide.create,
    isPending: roles.isPending || (!system && campuses.isPending),
    isError: roles.isError || campuses.isError,
  };
}
