import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { setSessionHooks } from '@/api/client';
import type { Session } from '@/api/types';
import { resetCache, SESSION_KEY } from './session';
import { startSessionSync } from './session-sync';

/**
 * Conecta el cliente de la API con la caché y con las demás pestañas: si la
 * renovación falla, la sesión pasa a null y los guardas de ruta llevan al
 * login; si cambió la institución activa, se muestra la nueva.
 */
export function SessionBridge() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const current = () => queryClient.getQueryData<Session | null>(SESSION_KEY);
    setSessionHooks({
      expired: () => {
        // Sin sesión previa (p. ej. la primera carga) no hay nada que limpiar: la
        // consulta de /auth/me ya resuelve null. Limpiar aquí la relanzaría.
        if (!current()) return;
        resetCache(queryClient, null);
        toast.info('Tu sesión terminó. Vuelve a ingresar para continuar.');
      },
      activeInstitution: () => {
        const session = current();
        return session ? session.activeInstitutionId : undefined;
      },
      institutionChanged: (session) => {
        resetCache(queryClient, session);
        toast.warning(
          'Ya no tienes acceso a la institución en la que estabas. Elige con cuál quieres seguir.',
        );
      },
    });
    const stopSync = startSessionSync(queryClient);
    return () => {
      setSessionHooks(null);
      stopSync();
    };
  }, [queryClient]);
  return null;
}
