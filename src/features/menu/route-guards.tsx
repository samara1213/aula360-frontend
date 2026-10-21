import { Outlet } from 'react-router';
import { useSession } from '@/auth/session';
import { NotFoundPage } from '@/features/layout/status-pages';
import { findBySlug, useMyMenu } from './menu';

/**
 * Pantalla de una opción del menú: sin permiso de ver, «no encontrada» (no se
 * revela si existe). Solo decide qué se muestra; el backend autoriza.
 */
export function RequireMenuView({ slug }: { slug: string }) {
  const { data: menu, isPending, fetchStatus } = useMyMenu();
  if (isPending && fetchStatus !== 'idle') return null;
  const node = menu ? findBySlug(menu, slug) : undefined;
  if (!node?.permissions.view) return <NotFoundPage />;
  return <Outlet />;
}

/** Pantallas del SUPER_ADMIN (el backend las protege con @SuperAdminOnly). */
export function RequireSuperAdmin() {
  const { data: session } = useSession();
  if (session?.user.userType !== 'SUPER_ADMIN') return <NotFoundPage />;
  return <Outlet />;
}
