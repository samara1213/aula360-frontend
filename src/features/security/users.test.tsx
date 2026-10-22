import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { SESSION_KEY } from '@/auth/session';
import type { ManagedUser } from '@/api/types';
import { apiError, apiUrl, FULL, mockSignedIn, page, securityMenu } from '@/test/api';
import { campus, managedUser, role } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const USER_ID = managedUser().id;
const NEW_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const ROLE_ID = role().id;
const CAMPUS_ID = '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
const PASSWORD = 'Temporal-9x2!Kq';

/** Usuarios, roles y sedes falsos de la institución activa. */
function mockUsers(target: ManagedUser = managedUser()) {
  const calls = {
    created: [] as unknown[],
    updated: [] as unknown[],
    assigned: [] as unknown[],
    status: [] as unknown[],
    passwords: 0,
  };
  let current = target;
  server.use(
    http.get(apiUrl('/api/users'), () => HttpResponse.json(page([current]))),
    http.get(apiUrl('/api/users/:id'), ({ params }) =>
      params.id === current.id
        ? HttpResponse.json(current)
        : apiError(404, 'Usuario no encontrado'),
    ),
    http.post(apiUrl('/api/users'), async ({ request }) => {
      const body = (await request.json()) as Partial<ManagedUser>;
      calls.created.push(body);
      current = managedUser({ ...body, id: NEW_ID, mustChangePassword: true });
      return HttpResponse.json({ ...current, temporaryPassword: PASSWORD }, { status: 201 });
    }),
    http.patch(apiUrl('/api/users/:id'), async ({ request }) => {
      const body = (await request.json()) as Partial<ManagedUser>;
      calls.updated.push(body);
      current = { ...current, ...body };
      return HttpResponse.json(current);
    }),
    http.patch(apiUrl('/api/users/:id/status'), async ({ request }) => {
      const body = (await request.json()) as { isActive: boolean };
      calls.status.push(body);
      current = { ...current, isActive: body.isActive };
      return HttpResponse.json(current);
    }),
    http.post(apiUrl('/api/users/:id/temporary-password'), () => {
      calls.passwords += 1;
      return HttpResponse.json({ temporaryPassword: PASSWORD });
    }),
    http.post(apiUrl('/api/role-assignments'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.assigned.push(body);
      current = {
        ...current,
        assignments: [
          ...current.assignments,
          {
            id: 'a-new',
            role: { id: ROLE_ID, name: 'Coordinación académica', isGlobal: false },
            campus: body.campusId ? { id: CAMPUS_ID, name: 'Norte', isActive: true } : null,
          },
        ],
      };
      return HttpResponse.json({}, { status: 201 });
    }),
    http.get(apiUrl('/api/roles'), () => HttpResponse.json(page([role()]))),
    http.get(apiUrl('/api/campuses'), () =>
      HttpResponse.json(page([campus({ id: CAMPUS_ID, name: 'Norte' })])),
    ),
  );
  return calls;
}

describe('usuarios de la institución', () => {
  it('crea un usuario, muestra la contraseña una sola vez y no la deja en la caché', async () => {
    mockSignedIn(makeSession(), securityMenu());
    const calls = mockUsers();
    const user = userEvent.setup();
    const { router, queryClient } = renderApp('/security/users');

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' });
    await user.type(within(dialog).getByLabelText('Número de documento'), '99887766');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Lucía');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Mora');
    await user.selectOptions(within(dialog).getByLabelText('Rol'), ROLE_ID);
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));

    const done = await screen.findByRole('dialog', { name: 'Usuario creado' });
    expect(within(done).getByLabelText('Contraseña temporal')).toHaveTextContent(PASSWORD);
    expect(within(done).getByText(/No tiene correo/)).toBeInTheDocument();
    expect(calls.created).toEqual([
      {
        documentType: 'CC',
        documentNumber: '99887766',
        firstName: 'Lucía',
        lastName: 'Mora',
        email: null,
        phone: null,
        userType: 'INSTITUTION_ADMIN',
        roleId: ROLE_ID,
        campusId: null,
      },
    ]);

    await user.click(within(done).getByRole('button', { name: 'Listo' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/security/users/${NEW_ID}`);
    });
    expect(await screen.findByRole('heading', { name: 'Lucía Mora' })).toBeInTheDocument();
    // La contraseña no queda en ninguna consulta ni mutación guardada.
    const cached = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
      queryClient
        .getMutationCache()
        .getAll()
        .map((m) => m.state.data),
    ]);
    expect(cached).not.toContain(PASSWORD);
    expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
  });

  it('en la ficha guarda solo lo que cambió, asigna un rol en una sede y genera una contraseña', async () => {
    mockSignedIn(makeSession(), securityMenu());
    const calls = mockUsers();
    const user = userEvent.setup();
    renderApp(`/security/users/${USER_ID}`);

    const phone = await screen.findByLabelText('Teléfono (opcional)');
    await user.type(phone, '+57 300 123 4567');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Datos guardados.')).toBeInTheDocument();
    expect(calls.updated).toEqual([{ phone: '+57 300 123 4567' }]);

    await user.click(screen.getByRole('button', { name: 'Asignar rol' }));
    const assign = await screen.findByRole('dialog', { name: 'Asignar rol' });
    await user.selectOptions(within(assign).getByLabelText('Rol'), ROLE_ID);
    await user.selectOptions(within(assign).getByLabelText('Dónde'), CAMPUS_ID);
    await user.click(within(assign).getByRole('button', { name: 'Asignar rol' }));
    expect(await screen.findByText('Rol asignado.')).toBeInTheDocument();
    expect(calls.assigned).toEqual([{ userId: USER_ID, roleId: ROLE_ID, campusId: CAMPUS_ID }]);
    expect(await screen.findByText('Norte')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nueva contraseña temporal' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Generar contraseña' }));
    const shown = await screen.findByRole('dialog', { name: 'Contraseña temporal nueva' });
    expect(within(shown).getByText(/También se la enviamos a su correo/)).toBeInTheDocument();
    expect(calls.passwords).toBe(1);
    await user.click(within(shown).getByRole('button', { name: 'Listo' }));
    await waitFor(() => {
      expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    });
  });

  it('desactiva un usuario después de confirmar', async () => {
    mockSignedIn(makeSession(), securityMenu());
    const calls = mockUsers();
    const user = userEvent.setup();
    renderApp(`/security/users/${USER_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Desactivar a Carlos Ruiz?' });
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar usuario' }));
    expect(await screen.findByText('Carlos Ruiz quedó inactivo.')).toBeInTheDocument();
    expect(calls.status).toEqual([{ isActive: false }]);
  });

  it('con el permiso limitado a una sede: exige la sede y no ofrece administradores', async () => {
    mockSignedIn(makeSession(), securityMenu(FULL, { siteOnly: true }));
    const calls = mockUsers();
    const user = userEvent.setup();
    renderApp('/security/users');

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' });
    expect(within(dialog).getByRole('option', { name: 'Administrativo' })).toBeDisabled();
    expect(within(dialog).queryByRole('option', { name: 'Toda la institución' })).toBeNull();
    await user.selectOptions(within(dialog).getByLabelText('Tipo de usuario'), 'TEACHER');
    await user.type(within(dialog).getByLabelText('Número de documento'), '123');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Ana');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Gil');
    await user.selectOptions(within(dialog).getByLabelText('Rol'), ROLE_ID);
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(
      await within(dialog).findByText('Elige la sede: solo puedes asignar roles en tus sedes.'),
    ).toBeInTheDocument();
    expect(calls.created).toHaveLength(0);
  });

  /** Abre la ficha y genera una contraseña temporal; devuelve el diálogo que la muestra. */
  async function showResetPassword(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Nueva contraseña temporal' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Generar contraseña' }));
    const shown = await screen.findByRole('dialog', { name: 'Contraseña temporal nueva' });
    expect(within(shown).getByLabelText('Contraseña temporal')).toHaveTextContent(PASSWORD);
    return shown;
  }

  it('la contraseña se descarta al cerrar con Escape, con la X o al salir de la ficha', async () => {
    mockSignedIn(makeSession(), securityMenu());
    mockUsers();
    const user = userEvent.setup();
    const { router } = renderApp(`/security/users/${USER_ID}`);

    await showResetPassword(user);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    });

    const shown = await showResetPassword(user);
    await user.click(within(shown).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => {
      expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    });

    await showResetPassword(user);
    await router.navigate('/security/users');
    await waitFor(() => {
      expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    });
    await router.navigate(`/security/users/${USER_ID}`);
    await screen.findByRole('heading', { name: 'Carlos Ruiz' });
    expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
  });

  it('si la sesión cambia (otra cuenta en otra pestaña), la contraseña desaparece', async () => {
    mockSignedIn(makeSession(), securityMenu());
    mockUsers();
    const user = userEvent.setup();
    const { queryClient } = renderApp('/security/users');

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' });
    await user.type(within(dialog).getByLabelText('Número de documento'), '99887766');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Lucía');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Mora');
    await user.selectOptions(within(dialog).getByLabelText('Rol'), ROLE_ID);
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByRole('dialog', { name: 'Usuario creado' })).toHaveTextContent(
      PASSWORD,
    );

    const other = makeSession({ user: { id: 'user-2', firstName: 'Otro', lastName: 'Usuario' } });
    mockSignedIn(other, securityMenu());
    queryClient.setQueryData(SESSION_KEY, other);
    await waitFor(() => {
      expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: 'Usuario creado' })).toBeNull();
  });

  it('a un SUPER_ADMIN no se le genera contraseña temporal, pero sí se puede desactivar', async () => {
    mockSignedIn(makeSession(), securityMenu());
    mockUsers(managedUser({ userType: 'SUPER_ADMIN' }));
    renderApp(`/security/users/${USER_ID}`);
    expect(await screen.findByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva contraseña temporal' })).toBeNull();
  });

  it('la propia cuenta no se gestiona desde aquí', async () => {
    mockSignedIn(makeSession({ user: { id: USER_ID } }), securityMenu());
    mockUsers();
    renderApp(`/security/users/${USER_ID}`);
    expect(await screen.findByText(/Es tu propia cuenta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar rol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nombres')).toBeDisabled();
  });
});
