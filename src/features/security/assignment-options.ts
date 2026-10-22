import { useCampuses } from '@/features/institution/institution-api';
import { usePermissions } from '@/features/menu/menu';
import { roleLabel } from '@/lib/roles';
import { useRoles } from './roles-api';
import type { UsersScope } from './users-api';

// Una institución tiene pocos roles y sedes: la primera página (máximo del backend) basta.
const ALL_ROWS = { page: 1, limit: 100 } as const;

export type Option = { value: string; label: string };

/** Roles globales que van con su ficha: se dan al crear desde Personas (B3 de la 3c). */
const PROFILE_ROLES = new Set(['TEACHER', 'STUDENT']);

/**
 * Roles y sedes que se pueden elegir al crear un usuario o asignar un rol.
 * - Institución activa: los roles propios y los globales, y sus sedes activas.
 *   «Toda la institución» solo si quien asigna tiene el permiso en toda ella
 *   (el backend responde 403 a un alcance de sede).
 * - SUPER_ADMIN en otra institución: solo los roles globales (no hay endpoint
 *   para listar los roles propios de otra), en toda ella o en una de sus sedes.
 */
export function useAssignmentOptions(scope: UsersScope) {
  const system = scope.kind === 'system';
  const roles = useRoles(system ? 'global' : 'institution', ALL_ROWS);
  const campuses = useCampuses({ ...ALL_ROWS, isActive: true }, { scope });
  const wide = usePermissions('security.users').institutionWide;

  const toOption = (role: { id: string; name: string; isGlobal: boolean }): Option => ({
    value: role.id,
    label: roleLabel(role),
  });
  const allRoles = roles.data?.data ?? [];
  const campusOptions: Option[] = (campuses.data?.data ?? []).map((campus) => ({
    value: campus.id,
    label: campus.name,
  }));

  return {
    roles: allRoles.map(toOption),
    /** Para crear personal administrativo: sin los roles de docente y estudiante. */
    staffRoles: allRoles
      .filter((role) => !(role.isGlobal && PROFILE_ROLES.has(role.name)))
      .map(toOption),
    campuses: campusOptions,
    /** Se puede dejar sin sede (toda la institución). */
    allowWholeInstitution: system || wide.create,
    /** Se pueden crear administradores (exige alcance en toda la institución). */
    canCreateAdmins: system || wide.create,
    isPending: roles.isPending || campuses.isPending,
    isError: roles.isError || campuses.isError,
  };
}
