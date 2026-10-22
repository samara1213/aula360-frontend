import type { MenuPermissions, Role } from '@/api/types';
import { usePermissions } from '@/features/menu/menu';
import type { RoleScope } from './roles-api';

const ALL: MenuPermissions = { view: true, create: true, update: true, delete: true };

export const ROLE_PATHS: Record<RoleScope, string> = {
  institution: '/security/roles',
  global: '/admin/global-roles',
};

/**
 * Lo que la pantalla ofrece hacer. En la institución, los permisos de toda la
 * institución (el backend no deja gestionar roles con un rol de una sede); el
 * SUPER_ADMIN, todo con los globales.
 */
export function useRolePermissions(scope: RoleScope): MenuPermissions {
  const wide = usePermissions('security.roles').institutionWide;
  return scope === 'global' ? ALL : wide;
}

/** Los globales se ven desde la institución, pero solo los cambia el SUPER_ADMIN. */
export function isEditable(scope: RoleScope, role: Pick<Role, 'isGlobal'>) {
  return scope === 'global' || !role.isGlobal;
}
