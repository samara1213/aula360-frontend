import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { MenuNode, Session } from '@/api/types';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const url = (path: string) => new URL(path, window.location.origin).toString();
const unauthorized = () =>
  HttpResponse.json({ statusCode: 401, message: 'No autorizado' }, { status: 401 });

const MENU: MenuNode[] = [
  {
    id: 'm1',
    name: 'Académico',
    slug: 'academic',
    icon: 'book-open',
    displayOrder: 1,
    permissions: { view: true, create: false, update: false, delete: false },
    institutionWide: { view: true, create: false, update: false, delete: false },
    children: [
      {
        id: 'm2',
        name: 'Periodos',
        slug: 'academic.periods',
        icon: 'calendar-range',
        displayOrder: 1,
        permissions: { view: true, create: true, update: true, delete: false },
        institutionWide: { view: true, create: true, update: true, delete: false },
        children: [],
      },
    ],
  },
];

/** Backend falso: sin sesión hasta que el login la crea. */
function mockBackend(initial: Session | null, afterLogin: Session = makeSession()) {
  let session = initial;
  const calls = { login: [] as unknown[] };
  server.use(
    http.get(url('/api/auth/me'), () => (session ? HttpResponse.json(session) : unauthorized())),
    http.post(url('/api/auth/refresh-token'), () =>
      session ? new HttpResponse(null, { status: 204 }) : unauthorized(),
    ),
    http.post(url('/api/auth/login'), async ({ request }) => {
      const body = (await request.json()) as { identifier: string; password: string };
      calls.login.push(body);
      if (body.password !== 'Correcta*2026') {
        return HttpResponse.json(
          { statusCode: 401, message: 'Credenciales inválidas' },
          { status: 401 },
        );
      }
      session = afterLogin;
      return HttpResponse.json(session);
    }),
    http.post(url('/api/auth/logout'), () => {
      session = null;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(url('/api/menu-options/my-menu'), () => HttpResponse.json(MENU)),
  );
  return calls;
}

describe('flujo de sesión', () => {
  it('sin sesión, una ruta protegida lleva al login y vuelve a ella tras ingresar', async () => {
    const calls = mockBackend(null);
    const user = userEvent.setup();
    const { router } = renderApp('/academic/periods');

    expect(await screen.findByRole('heading', { name: 'Hola de nuevo' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Facademic%2Fperiods');

    await user.type(screen.getByLabelText('Correo o documento'), 'ana@colegio.edu.co');
    await user.type(screen.getByLabelText('Contraseña'), 'Correcta*2026');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Periodos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/academic/periods');
    expect(calls.login).toEqual([{ identifier: 'ana@colegio.edu.co', password: 'Correcta*2026' }]);
  });

  it('valida los campos antes de enviar', async () => {
    const calls = mockBackend(null);
    const user = userEvent.setup();
    renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(screen.getByText('Escribe tu correo o tu número de documento.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.login).toHaveLength(0);
  });

  it('con credenciales malas por documento ofrece elegir el tipo y lo envía', async () => {
    const calls = mockBackend(null);
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(await screen.findByLabelText('Correo o documento'), '1020304050');
    await user.type(screen.getByLabelText('Contraseña'), 'Mala*2026xx');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
    await user.click(screen.getByRole('button', { name: 'elige el tipo' }));
    await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'TI');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(calls.login).toHaveLength(2);
    });
    expect(calls.login[1]).toEqual({
      identifier: '1020304050',
      password: 'Mala*2026xx',
      documentType: 'TI',
    });
  });

  it('con contraseña temporal obliga a cambiarla antes de seguir', async () => {
    mockBackend(makeSession({ user: { mustChangePassword: true } }));
    const { router } = renderApp('/');
    expect(await screen.findByText(/Entraste con una contraseña temporal/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/change-password');
  });

  it('con varias instituciones sin elegir, pide escoger una', async () => {
    mockBackend(
      makeSession({
        activeInstitutionId: null,
        institutions: [
          { id: 'a', name: 'Colegio A', roles: ['TEACHER'] },
          { id: 'b', name: 'Colegio B', roles: ['INSTITUTION_ADMIN'] },
        ],
      }),
    );
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: '¿Dónde vas a trabajar hoy?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Colegio B/ })).toBeInTheDocument();
  });

  it('muestra el menú dinámico y una opción que no está en él responde como no encontrada', async () => {
    mockBackend(makeSession());
    renderApp('/security/roles');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Menú principal' })[0];
    expect(nav).toHaveTextContent('Periodos');
  });

  it('cerrar sesión vuelve al login', async () => {
    mockBackend(makeSession());
    const user = userEvent.setup();
    const { router } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: /Tu cuenta: Ana Pérez/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cerrar sesión' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    // Sin ?next=: el siguiente usuario no aterriza en la ruta del anterior (B2).
    expect(router.state.location.search).toBe('');
  });

  it('si el backend no cerró la sesión, no limpia la pantalla y lo dice (M3)', async () => {
    mockBackend(makeSession());
    server.use(
      http.post(url('/api/auth/logout'), () =>
        HttpResponse.json({ statusCode: 503, message: 'x' }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: /Tu cuenta: Ana Pérez/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cerrar sesión' }));
    expect(await screen.findByText(/No pudimos cerrar la sesión/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('sin institución activa y con una sola disponible, pide elegirla (M1)', async () => {
    mockBackend(makeSession({ activeInstitutionId: null }));
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: '¿Dónde vas a trabajar hoy?' }),
    ).toBeInTheDocument();
  });
});
