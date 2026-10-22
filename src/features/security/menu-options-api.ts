import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type { CreateMenuOptionBody, MenuOptionNode, UpdateMenuOptionBody } from '@/api/types';

/** Máximo de niveles del menú (Padre → Hijo → Nieto), igual que el backend. */
export const MAX_MENU_DEPTH = 3;

/** Tras cambiar el árbol: el árbol y el menú propio (puede mostrar u ocultar opciones). */
function useInvalidateMenus() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['menu-options'] }),
      queryClient.invalidateQueries({ queryKey: ['menu'] }),
    ]);
}

export function useCreateMenuOption() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: (body: CreateMenuOptionBody) => unwrap(api.POST('/api/menu-options', { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateMenuOption() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMenuOptionBody }) =>
      unwrap(api.PATCH('/api/menu-options/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

export function useSetMenuOptionActive() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      unwrap(
        active
          ? api.PATCH('/api/menu-options/{id}/activate', { params: { path: { id } } })
          : api.PATCH('/api/menu-options/{id}/deactivate', { params: { path: { id } } }),
      ),
    onSuccess: invalidate,
  });
}

/** Opciones en orden de lectura, con su nivel (1 = raíz). */
export function flatten(
  nodes: readonly MenuOptionNode[],
  depth = 1,
): { node: MenuOptionNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

/** Niveles que tiene la rama de una opción (ella sola = 1). */
export function branchHeight(node: MenuOptionNode): number {
  return 1 + Math.max(0, ...node.children.map(branchHeight));
}

/**
 * Padres posibles para una opción (null = raíz): sin ella misma ni su rama, y
 * sin pasar de los niveles máximos con la rama que se mueve.
 */
export function parentChoices(
  tree: readonly MenuOptionNode[],
  moving?: MenuOptionNode,
): { node: MenuOptionNode; depth: number }[] {
  const height = moving ? branchHeight(moving) : 1;
  const excluded = new Set(moving ? flatten([moving]).map(({ node }) => node.id) : []);
  return flatten(tree).filter(
    ({ node, depth }) => !excluded.has(node.id) && depth + height <= MAX_MENU_DEPTH,
  );
}
