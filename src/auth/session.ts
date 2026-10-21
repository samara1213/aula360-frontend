import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api, unwrap } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { Session } from '@/api/types';
import type { components } from '@/api/schema';

export const SESSION_KEY = ['session'] as const;

type LoginBody = components['schemas']['LoginDto'];
type ChangePasswordBody = components['schemas']['ChangePasswordDto'];

/** Sesión actual, o null si no hay (401 tras intentar renovar). */
async function fetchSession(): Promise<Session | null> {
  try {
    return await unwrap(api.GET('/api/auth/me'));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 5 * 60_000 });
}

/** Quién es y dónde trabaja: si cambia, los datos guardados ya no le corresponden. */
export function sessionIdentity(session: Session | null | undefined): string | undefined {
  if (session === undefined) return undefined;
  if (session === null) return 'sin-sesion';
  return `${session.user.id}|${session.activeInstitutionId ?? '-'}|${String(session.user.mustChangePassword)}`;
}

function currentIdentity(queryClient: QueryClient): string | undefined {
  return sessionIdentity(queryClient.getQueryData<Session | null>(SESSION_KEY));
}

/**
 * onMutate y onSuccess de una mutación que guarda su respuesta en la caché: si
 * mientras esperaba cambió la sesión (otra cuenta u otra institución, también
 * desde otra pestaña), la respuesta se descarta. resetCache borra las
 * consultas, pero no detiene las peticiones en curso (M1 de la fase 3b-1).
 */
export function forSameSession<TData, TVariables>(
  queryClient: QueryClient,
  onSuccess: (data: TData, variables: TVariables) => unknown,
) {
  return {
    onMutate: () => ({ identity: currentIdentity(queryClient) }),
    onSuccess: (
      data: TData,
      variables: TVariables,
      started: { identity: string | undefined } | undefined,
    ) => {
      if (started?.identity !== currentIdentity(queryClient)) return;
      return onSuccess(data, variables);
    },
  };
}

/** Deja la caché solo con la sesión indicada (datos de otra cuenta o institución, fuera). */
export function resetCache(queryClient: QueryClient, session: Session | null) {
  // No clear(): desconectaría a los componentes que observan la sesión.
  removeNonSessionQueries(queryClient);
  queryClient.setQueryData(SESSION_KEY, session);
}

export function removeNonSessionQueries(queryClient: QueryClient) {
  const others = {
    predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[0] !== SESSION_KEY[0],
  };
  void queryClient.cancelQueries(others);
  queryClient.removeQueries(others);
}

// Las mutaciones con contraseñas no se guardan en la caché de mutaciones
// después de terminar (sus variables quedarían en memoria: B1 de la fase 3a).
const FORGET_VARIABLES = { gcTime: 0 } as const;

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    ...FORGET_VARIABLES,
    mutationFn: (body: LoginBody) => unwrap(api.POST('/api/auth/login', { body })),
    onSuccess: (session) => {
      resetCache(queryClient, session);
    },
  });
}

/**
 * Solo se limpia la pantalla si el backend cerró la sesión: con un fallo de red
 * o del servidor las cookies siguen vigentes y el siguiente usuario del equipo
 * entraría a esta cuenta (M3 de la fase 3a). Va al login sin `next`.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/auth/logout')),
    onSuccess: () => {
      void navigate('/login', { replace: true });
      resetCache(queryClient, null);
    },
    onError: () => {
      toast.error('No pudimos cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.');
    },
  });
}

export function useSwitchInstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (institutionId: string) =>
      unwrap(api.POST('/api/auth/switch-institution', { body: { institutionId } })),
    onSuccess: (session) => {
      resetCache(queryClient, session);
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    ...FORGET_VARIABLES,
    mutationFn: (body: ChangePasswordBody) =>
      unwrap(api.POST('/api/auth/change-password', { body })),
    onSuccess: () => {
      // Ya no es temporal: se refleja al instante para que el guarda deje pasar.
      queryClient.setQueryData<Session | null>(SESSION_KEY, (old) =>
        old ? { ...old, user: { ...old.user, mustChangePassword: false } } : old,
      );
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

// Caracteres de control y barras invertidas: el analizador de URL los quita o
// los convierte, y `/\t/otro.sitio` terminaría en `//otro.sitio`.
function hasUnsafeChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/** Ruta interna segura para volver tras el login (evita redirecciones abiertas). */
export function safeNext(value: string | null | undefined): string {
  if (!value?.startsWith('/') || hasUnsafeChars(value)) return '/';
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
