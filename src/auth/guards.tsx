import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageError, FullPageLoader } from '@/components/full-page-state';
import { safeNext, useSession } from './session';

export const CHANGE_PASSWORD_PATH = '/change-password';
export const SELECT_INSTITUTION_PATH = '/select-institution';

/**
 * Rutas con sesión. Orden: sin sesión → login; contraseña temporal → cambio
 * obligatorio; varias instituciones sin elegir → selector.
 */
export function RequireSession() {
  const { data: session, isPending, isError, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <FullPageLoader />;
  if (isError) return <FullPageError onRetry={() => void refetch()} />;
  if (!session) {
    const next = location.pathname + location.search;
    const query = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
    return <Navigate to={`/login${query}`} replace />;
  }

  const here = location.pathname;
  if (session.user.mustChangePassword) {
    return here === CHANGE_PASSWORD_PATH ? (
      <Outlet />
    ) : (
      <Navigate to={CHANGE_PASSWORD_PATH} replace />
    );
  }
  // Sin institución activa y con alguna disponible (también si le queda una
  // sola tras retirarlo de otra: el backend no la elige por su cuenta).
  const mustChoose = session.activeInstitutionId == null && session.institutions.length > 0;
  if (mustChoose && here !== SELECT_INSTITUTION_PATH && here !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={SELECT_INSTITUTION_PATH} replace />;
  }
  return <Outlet />;
}

/** Login y recuperación: con sesión abierta no tienen sentido. */
export function PublicOnly() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  if (isPending) return <FullPageLoader />;
  if (session) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={safeNext(next)} replace />;
  }
  return <Outlet />;
}
