import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type { MenuNode, MenuPermissions } from '@/api/types';
import { useSession } from '@/auth/session';

export const MENU_KEY = ['menu', 'mine'] as const;

/** Menú de la institución activa (vacío sin institución activa). */
export function useMyMenu() {
  const { data: session } = useSession();
  const active = session?.activeInstitutionId ?? null;
  return useQuery({
    queryKey: [...MENU_KEY, active],
    queryFn: () => unwrap(api.GET('/api/menu-options/my-menu')),
    enabled: active !== null,
    staleTime: 5 * 60_000,
  });
}

/** Ruta de una opción: `academic.performance-levels` → `/academic/performance-levels`. */
export function slugToPath(slug: string): string {
  return '/' + slug.split('.').map(encodeURIComponent).join('/');
}

export function findBySlug(nodes: readonly MenuNode[], slug: string): MenuNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findBySlug(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

const NONE: MenuPermissions = { view: false, create: false, update: false, delete: false };

/**
 * Permisos del usuario en una opción. Solo sirven para la interfaz (mostrar u
 * ocultar botones): quien decide es el backend.
 * institutionWide: los que valen en toda la institución (sin los de roles
 * limitados a una sede). Las acciones que el backend exige en toda la
 * institución (logo, sedes) se muestran según estos.
 */
export function usePermissions(
  slug: string,
): MenuPermissions & { institutionWide: MenuPermissions; isLoading: boolean } {
  const { data, isLoading } = useMyMenu();
  const node = data ? findBySlug(data, slug) : undefined;
  return {
    ...(node?.permissions ?? NONE),
    institutionWide: node?.institutionWide ?? NONE,
    isLoading,
  };
}
