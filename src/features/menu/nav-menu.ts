import type { MenuNode, MenuPermissions } from '@/api/types';
import { useSession } from '@/auth/session';
import { useMyMenu } from './menu';

/** Opción del menú lateral. `end`: activa solo en su ruta exacta, no en las de abajo. */
export type NavNode = Omit<MenuNode, 'children'> & { end?: boolean; children: NavNode[] };

const ALL: MenuPermissions = { view: true, create: true, update: true, delete: true };

/**
 * Menú fijo del SUPER_ADMIN: no depende de una institución (no tiene menú en
 * la base de datos). El backend autoriza cada endpoint con @SuperAdminOnly.
 */
export const ADMIN_MENU: NavNode[] = [
  {
    id: 'admin',
    slug: 'admin',
    name: 'Administración general',
    icon: 'shield',
    displayOrder: 0,
    permissions: ALL,
    institutionWide: ALL,
    children: [
      {
        id: 'admin.institutions',
        slug: 'admin.institutions',
        name: 'Instituciones',
        icon: 'school',
        displayOrder: 1,
        permissions: ALL,
        institutionWide: ALL,
        children: [],
      },
      {
        id: 'admin.global-roles',
        slug: 'admin.global-roles',
        name: 'Roles globales',
        icon: 'key',
        displayOrder: 2,
        permissions: ALL,
        institutionWide: ALL,
        children: [],
      },
      {
        id: 'admin.menu-options',
        slug: 'admin.menu-options',
        name: 'Opciones de menú',
        icon: 'list-tree',
        displayOrder: 3,
        permissions: ALL,
        institutionWide: ALL,
        children: [],
      },
    ],
  },
];

/**
 * «Institución» es un grupo (sus hijos son Sedes...): su propia página
 * (`/institution`, datos y logo) entra como primer enlace del grupo, con los
 * permisos del grupo (`institution`, el que usa el backend).
 */
function withInstitutionPage(nodes: readonly MenuNode[]): NavNode[] {
  return nodes.map((node) =>
    node.slug === 'institution' && node.children.length > 0 && node.permissions.view
      ? {
          ...node,
          children: [
            {
              ...node,
              id: `${node.id}:page`,
              name: 'Datos de la institución',
              displayOrder: 0,
              end: true,
              children: [],
            },
            ...node.children,
          ],
        }
      : node,
  );
}

/** Lo que muestra el menú lateral y el inicio. */
export function useNavMenu() {
  const { data: session } = useSession();
  const menu = useMyMenu();
  const isSuperAdmin = session?.user.userType === 'SUPER_ADMIN';
  const institutionNodes = menu.data ? withInstitutionPage(menu.data) : undefined;
  const loading = menu.isPending && menu.fetchStatus !== 'idle';
  const nodes = isSuperAdmin ? [...ADMIN_MENU, ...(institutionNodes ?? [])] : institutionNodes;
  return { nodes, loading, isError: menu.isError, refetch: menu.refetch };
}
