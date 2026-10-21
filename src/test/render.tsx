import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createQueryClient } from '@/api/query-client';
import type { Session } from '@/api/types';
import { Providers } from '@/providers';
import { routes } from '@/router';

/** Monta la aplicación completa en una ruta, con MSW respondiendo a la API. */
export function renderApp(path: string) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...view, router, queryClient };
}

export function makeSession(
  overrides: Partial<Omit<Session, 'user'>> & { user?: Partial<Session['user']> } = {},
): Session {
  const { user, ...rest } = overrides;
  return {
    activeInstitutionId: 'inst-1',
    institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['INSTITUTION_ADMIN'] }],
    ...rest,
    user: {
      id: 'user-1',
      userType: 'INSTITUTION_ADMIN',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@colegio.edu.co',
      emailVerified: true,
      pendingEmail: null,
      hasAvatar: false,
      mustChangePassword: false,
      ...user,
    },
  };
}
