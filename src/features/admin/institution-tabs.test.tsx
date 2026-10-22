import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ManagedUser } from '@/api/types';
import { SESSION_KEY } from '@/auth/session';
import { apiError, apiUrl, mockSignedIn, page, superAdminSession } from '@/test/api';
import { campus, institution, managedUser, role } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const ID = '0f1e2d3c-4b5a-4697-8877-665544332211';
const NEW_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const ADMIN_ROLE = role({
  id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  name: 'INSTITUTION_ADMIN',
  isGlobal: true,
  institutionId: null,
});
const PASSWORD = 'Primera-7Lm!x2';
const CAMPUS_ID = '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';

/** Institución del SUPER_ADMIN con sus usuarios y asignaciones. */
function mockInstitution() {
  const calls = {
    created: [] as unknown[],
    assigned: [] as unknown[],
    lookups: [] as string[],
    campuses: [] as unknown[],
  };
  let users: ManagedUser[] = [];
  let campuses = [campus({ id: CAMPUS_ID, name: 'Sede Norte', institutionId: ID })];
  server.use(
    http.get(apiUrl('/api/institutions/:id'), () => HttpResponse.json(institution({ id: ID }))),
    http.get(apiUrl('/api/global-roles'), () => HttpResponse.json(page([ADMIN_ROLE]))),
    http.get(apiUrl('/api/institutions/:id/users'), () => HttpResponse.json(page(users))),
    http.get(apiUrl('/api/institutions/:id/users/:userId'), ({ params }) => {
      const found = users.find((u) => u.id === params.userId);
      return found ? HttpResponse.json(found) : apiError(404, 'Usuario no encontrado');
    }),
    http.post(apiUrl('/api/institutions/:id/users'), async ({ request }) => {
      const body = (await request.json()) as Partial<ManagedUser>;
      calls.created.push(body);
      const created = managedUser({ ...body, id: NEW_ID, mustChangePassword: true });
      users = [created];
      return HttpResponse.json({ ...created, temporaryPassword: PASSWORD }, { status: 201 });
    }),
    http.get(apiUrl('/api/institutions/:id/campuses'), () => HttpResponse.json(page(campuses))),
    http.post(apiUrl('/api/institutions/:id/campuses'), async ({ request }) => {
      const body = (await request.json()) as { name: string };
      calls.campuses.push(body);
      campuses = [...campuses, campus({ id: NEW_ID, name: body.name, institutionId: ID })];
      return HttpResponse.json(campuses.at(-1), { status: 201 });
    }),
    http.patch(apiUrl('/api/institutions/:id/campuses/:campusId/deactivate'), ({ params }) => {
      calls.campuses.push({ deactivated: params.campusId });
      campuses = campuses.map((c) => (c.id === params.campusId ? { ...c, isActive: false } : c));
      return HttpResponse.json(campuses.find((c) => c.id === params.campusId));
    }),
    http.get(apiUrl('/api/institutions/:id/role-assignments'), () => HttpResponse.json(page([]))),
    http.post(apiUrl('/api/institutions/:id/role-assignments'), async ({ request }) => {
      calls.assigned.push(await request.json());
      return HttpResponse.json({}, { status: 201 });
    }),
    http.get(apiUrl('/api/users/lookup'), ({ request }) => {
      const query = new URL(request.url).searchParams;
      calls.lookups.push(query.toString());
      return query.get('email') === 'profe@otro.edu.co'
        ? HttpResponse.json({
            id: NEW_ID,
            firstName: 'Marta',
            lastName: 'León',
            documentType: 'CC',
            documentNumber: '55443322',
            email: 'profe@otro.edu.co',
          })
        : apiError(404, 'No hay un usuario activo con ese documento o correo');
    }),
  );
  return calls;
}

describe('detalle de institución (SUPER_ADMIN): pestañas', () => {
  it('crea el primer administrador con un rol global en toda la institución', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitution();
    const user = userEvent.setup();
    const { router } = renderApp(`/admin/institutions/${ID}`);

    await user.click(await screen.findByRole('tab', { name: 'Usuarios' }));
    expect(router.state.location.search).toBe('?tab=users');
    expect(await screen.findByText('Todavía no hay usuarios.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' });
    expect(within(dialog).getByLabelText('Dónde')).toHaveValue('');
    expect(within(dialog).getByRole('option', { name: 'Sede Norte' })).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Número de documento'), '80123456');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Rector');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Nuevo');
    await user.type(within(dialog).getByLabelText('Correo (opcional)'), 'rector@nuevo.edu.co');
    await user.selectOptions(
      within(dialog).getByLabelText('Rol'),
      within(dialog).getByRole('option', { name: 'Administrador de la institución' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));

    const done = await screen.findByRole('dialog', { name: 'Usuario creado' });
    expect(within(done).getByText(/También se la enviamos a su correo/)).toBeInTheDocument();
    expect(calls.created).toEqual([
      expect.objectContaining({
        userType: 'INSTITUTION_ADMIN',
        roleId: ADMIN_ROLE.id,
        campusId: null,
        email: 'rector@nuevo.edu.co',
      }),
    ]);
    await user.click(within(done).getByRole('button', { name: 'Listo' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/admin/institutions/${ID}/users/${NEW_ID}`);
    });
    expect(await screen.findByRole('heading', { name: 'Rector Nuevo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Usuarios de la institución' })).toHaveAttribute(
      'href',
      `/admin/institutions/${ID}?tab=users`,
    );
  });

  it('si entra otro SUPER_ADMIN (en otra pestaña), la contraseña mostrada desaparece', async () => {
    mockSignedIn(superAdminSession());
    mockInstitution();
    const user = userEvent.setup();
    const { queryClient } = renderApp(`/admin/institutions/${ID}?tab=users`);

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' });
    await user.type(within(dialog).getByLabelText('Número de documento'), '80123456');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Rector');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Nuevo');
    await user.selectOptions(
      within(dialog).getByLabelText('Rol'),
      within(dialog).getByRole('option', { name: 'Administrador de la institución' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByRole('dialog', { name: 'Usuario creado' })).toHaveTextContent(
      PASSWORD,
    );

    const other = superAdminSession();
    other.user = { ...other.user, id: 'super-2', firstName: 'Otra', lastName: 'Persona' };
    mockSignedIn(other);
    queryClient.setQueryData(SESSION_KEY, other);
    await waitFor(() => {
      expect(screen.queryByText(PASSWORD)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: 'Usuario creado' })).toBeNull();
  });

  it('asigna un rol a un usuario de otra institución buscándolo por correo exacto', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitution();
    const user = userEvent.setup();
    renderApp(`/admin/institutions/${ID}?tab=assignments`);

    await user.click(await screen.findByRole('button', { name: 'Asignar a un usuario existente' }));
    const dialog = await screen.findByRole('dialog', { name: 'Asignar a un usuario existente' });
    await user.type(within(dialog).getByLabelText('Correo'), 'profe@otro');
    await user.click(within(dialog).getByRole('button', { name: 'Buscar' }));
    expect(within(dialog).getByText('Escribe el correo completo.')).toBeInTheDocument();
    expect(calls.lookups).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('Correo'));
    await user.type(within(dialog).getByLabelText('Correo'), 'nadie@otro.edu.co');
    await user.click(within(dialog).getByRole('button', { name: 'Buscar' }));
    expect(
      await within(dialog).findByText(/No hay un usuario activo con esos datos/),
    ).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Correo'));
    await user.type(within(dialog).getByLabelText('Correo'), 'profe@otro.edu.co');
    await user.click(within(dialog).getByRole('button', { name: 'Buscar' }));
    const found = await within(dialog).findByRole('region', { name: 'Usuario encontrado' });
    expect(within(found).getByText('Marta León')).toBeInTheDocument();
    await user.click(within(found).getByRole('button', { name: 'Asignar rol a Marta' }));
    expect(within(found).getByText('Elige el rol.')).toBeInTheDocument();
    await user.selectOptions(
      within(found).getByLabelText('Rol en esta institución'),
      ADMIN_ROLE.id,
    );
    await user.selectOptions(within(found).getByLabelText('Dónde'), CAMPUS_ID);
    await user.click(within(found).getByRole('button', { name: 'Asignar rol a Marta' }));
    expect(await screen.findByText('Rol asignado a Marta León.')).toBeInTheDocument();
    expect(calls.assigned).toEqual([
      { userId: NEW_ID, roleId: ADMIN_ROLE.id, campusId: CAMPUS_ID },
    ]);
  });

  it('gestiona las sedes de la institución desde la pestaña «Sedes»', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitution();
    const user = userEvent.setup();
    const { router } = renderApp(`/admin/institutions/${ID}`);

    await user.click(await screen.findByRole('tab', { name: 'Sedes' }));
    expect(router.state.location.search).toBe('?tab=campuses');
    expect((await screen.findAllByText('Sede Norte')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Nueva sede' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sede' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Sede Sur');
    await user.click(within(dialog).getByRole('button', { name: 'Crear sede' }));
    expect(await screen.findByText('«Sede Sur» creada.')).toBeInTheDocument();
    expect(calls.campuses).toEqual([{ name: 'Sede Sur', address: null, city: null }]);

    const actions = screen.getAllByRole('button', { name: 'Acciones de Sede Norte' });
    await user.click(actions[0] as HTMLElement);
    await user.click(await screen.findByRole('menuitem', { name: 'Desactivar' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar sede' }));
    expect(await screen.findByText('«Sede Norte» quedó inactiva.')).toBeInTheDocument();
    expect(calls.campuses).toContainEqual({ deactivated: CAMPUS_ID });
  });

  it('un id de institución inválido en la ficha de usuario responde «no encontrada»', async () => {
    mockSignedIn(superAdminSession());
    mockInstitution();
    renderApp(`/admin/institutions/no-es-uuid/users/${NEW_ID}`);
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
  });
});
