import type { Query, QueryClient } from '@tanstack/react-query';
import type { Session } from '@/api/types';
import { removeNonSessionQueries, SESSION_KEY } from './session';

const CHANNEL = 'aula360-session';

/** Quién es y dónde trabaja: si cambia, los datos guardados ya no le corresponden. */
function identity(session: Session | null | undefined): string | undefined {
  if (session === undefined) return undefined;
  if (session === null) return 'sin-sesion';
  return `${session.user.id}|${session.activeInstitutionId ?? '-'}|${String(session.user.mustChangePassword)}`;
}

/**
 * Mantiene las pestañas de acuerdo (M2 de la fase 3a). Las cookies son las
 * mismas en todas, así que si en una se cierra la sesión, se entra con otra
 * cuenta o se cambia de institución, las demás deben enterarse:
 * - Cuando la sesión de esta pestaña cambia de identidad, borra los datos
 *   guardados de la anterior y avisa a las demás por BroadcastChannel.
 * - Al recibir el aviso, o al volver a la pestaña, relee /auth/me.
 *
 * Devuelve la función para detenerla.
 */
export function startSessionSync(queryClient: QueryClient): () => void {
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  let last = identity(queryClient.getQueryData<Session | null>(SESSION_KEY));

  const recheck = () => {
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    const query = event.query as Query;
    if (event.type !== 'updated' || query.queryKey[0] !== SESSION_KEY[0]) return;
    const current = identity(query.state.data as Session | null | undefined);
    if (current === undefined || current === last) return;
    const changed = last !== undefined;
    last = current;
    if (!changed) return;
    removeNonSessionQueries(queryClient);
    channel?.postMessage('changed');
  });

  if (channel) channel.onmessage = recheck;
  const onVisible = () => {
    if (document.visibilityState === 'visible') recheck();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    unsubscribe();
    channel?.close();
    document.removeEventListener('visibilitychange', onVisible);
  };
}
