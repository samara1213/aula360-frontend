import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError, ERROR_CODES } from './errors';

export function createQueryClient() {
  // Si un administrador asigna una contraseña temporal a mitad de la sesión, el
  // backend responde 403 con el código PASSWORD_CHANGE_REQUIRED: se relee la
  // sesión y el guarda de rutas lleva al cambio obligatorio.
  const onError = (error: unknown) => {
    if (
      error instanceof ApiError &&
      error.status === 403 &&
      error.code === ERROR_CODES.PASSWORD_CHANGE_REQUIRED
    ) {
      void client.invalidateQueries({ queryKey: ['session'] });
    }
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Reintentar solo fallos de red o del servidor, nunca 4xx.
        retry: (count, error) =>
          count < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
      },
      mutations: { retry: false },
    },
  });
  return client;
}
