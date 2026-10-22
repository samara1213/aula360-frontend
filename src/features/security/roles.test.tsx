import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { MenuNode, RoleDetail, RolePermissionInput } from '@/api/types';
import {
  apiError,
  apiUrl,
  FULL,
  menuNode,
  mockSignedIn,
  page,
  securityMenu,
  superAdminSession,
  VIEW_ONLY,
} from '@/test/api';
import { menuOption, role } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const ROLE_ID = role().id;
const GLOBAL_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

/** Institución con sedes (en toda la institución solo las ve) y seguridad completa. */
function adminMenu(): MenuNode[] {
  return [
    menuNode('institution', 'Institución', FULL, [
      menuNode('institution.campuses', 'Sedes', FULL, [], VIEW_ONLY),
    ]),
    ...securityMenu(),
  ];
}

/** Roles falsos: cuenta las lecturas del menú propio y guarda los PUT. */
function mockRoles(detail: RoleDetail = role()) {
  const calls = { myMenu: 0, put: [] as RolePermissionInput[][], created: [] as unknown[] };
  let current = detail;
  server.use(
    http.get(apiUrl('/api/menu-options/my-menu'), () => {
      calls.myMenu += 1;
      return HttpResponse.json(adminMenu());
    }),
    http.get(apiUrl('/api/roles'), () =>
      HttpResponse.json(
        page([
          role({ id: GLOBAL_ID, name: 'INSTITUTION_ADMIN', isGlobal: true, institutionId: null }),
          current,
        ]),
      ),
    ),
    http.get(apiUrl('/api/roles/:id'), ({ params }) =>
      params.id === current.id ? HttpResponse.json(current) : apiError(404, 'Rol no encontrado'),
    ),
    http.post(apiUrl('/api/roles'), async ({ request }) => {
      const body = (await request.json()) as { name: string };
      calls.created.push(body);
      current = role({ ...body, description: null });
      return HttpResponse.json(current, { status: 201 });
    }),
    http.put(apiUrl('/api/roles/:id/permissions'), async ({ request }) => {
      const body = (await request.json()) as { permissions: RolePermissionInput[] };
      calls.put.push(body.permissions);
      current = {
        ...current,
        permissions: body.permissions.map((p) => ({
          menuOptionId: p.menuOptionId,
          slug: p.menuOptionId,
          name: p.menuOptionId,
          canCreate: p.canCreate ?? false,
          canUpdate: p.canUpdate ?? false,
          canDelete: p.canDelete ?? false,
        })),
      };
      return HttpResponse.json(current);
    }),
    http.delete(apiUrl('/api/roles/:id'), () =>
      apiError(409, 'El rol está asignado a usuarios: quite las asignaciones antes de borrarlo'),
    ),
  );
  return calls;
}

describe('roles de la institución', () => {
  it('lista los roles; los globales con su nombre legible y sin acciones', async () => {
    mockSignedIn(makeSession(), adminMenu());
    mockRoles();
    renderApp('/security/roles');
    const table = await screen.findByRole('table', { name: 'Roles' });
    const global = within(table).getByRole('rowheader', {
      name: 'Administrador de la institución',
    });
    expect(within(global.closest('tr') as HTMLElement).getByText('Global')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Acciones de INSTITUTION_ADMIN' }),
    ).not.toBeInTheDocument();
    expect(
      within(table).getByRole('button', { name: 'Acciones de Coordinación académica' }),
    ).toBeInTheDocument();
  });

  it('crea un rol y lleva a sus permisos', async () => {
    mockSignedIn(makeSession(), adminMenu());
    const calls = mockRoles();
    const user = userEvent.setup();
    const { router } = renderApp('/security/roles');
    await user.click(await screen.findByRole('button', { name: 'Nuevo rol' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo rol' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Secretaría');
    await user.click(within(dialog).getByRole('button', { name: 'Crear rol' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/security/roles/${ROLE_ID}`);
    });
    expect(calls.created).toEqual([{ name: 'Secretaría', description: null }]);
    expect(await screen.findByRole('heading', { name: 'Secretaría' })).toBeInTheDocument();
  });

  it('la matriz marca los ancestros, respeta el tope y guarda lo que no muestra', async () => {
    mockSignedIn(makeSession(), adminMenu());
    const calls = mockRoles(
      role({
        permissions: [
          // Una opción que la matriz no muestra (p. ej. desactivada): se conserva.
          {
            menuOptionId: 'oculta',
            slug: 'x',
            name: 'x',
            canCreate: true,
            canUpdate: false,
            canDelete: false,
          },
        ],
      }),
    );
    const user = userEvent.setup();
    renderApp(`/security/roles/${ROLE_ID}`);

    const matrix = await screen.findByRole('table', { name: /Permisos del rol/ });
    // En toda la institución solo ve las sedes: no puede otorgar crearlas.
    expect(within(matrix).getByRole('checkbox', { name: 'Crear: Sedes' })).toBeDisabled();
    expect(within(matrix).getByRole('checkbox', { name: 'Ver: Sedes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Guardar permisos' })).toBeDisabled();

    await user.click(within(matrix).getByRole('checkbox', { name: 'Editar: Usuarios' }));
    expect(within(matrix).getByRole('checkbox', { name: 'Ver: Usuarios' })).toBeChecked();
    expect(within(matrix).getByRole('checkbox', { name: 'Ver: Seguridad' })).toBeChecked();

    const menuReads = calls.myMenu;
    await user.click(screen.getByRole('button', { name: 'Guardar permisos' }));
    expect(await screen.findByText('Permisos guardados.')).toBeInTheDocument();
    expect(calls.put).toHaveLength(1);
    expect(calls.put[0]).toEqual(
      expect.arrayContaining([
        { menuOptionId: 'm-security.users', canCreate: false, canUpdate: true, canDelete: false },
        { menuOptionId: 'm-security', canCreate: false, canUpdate: false, canDelete: false },
        { menuOptionId: 'oculta', canCreate: true, canUpdate: false, canDelete: false },
      ]),
    );
    expect(calls.put[0]).toHaveLength(3);
    // El menú propio se vuelve a leer: el rol puede ser de quien edita.
    await waitFor(() => {
      expect(calls.myMenu).toBeGreaterThan(menuReads);
    });
  });

  it('un rol con permisos que quien edita no tiene queda de solo lectura', async () => {
    mockSignedIn(makeSession(), adminMenu());
    mockRoles(
      role({
        permissions: [
          {
            menuOptionId: 'm-institution.campuses',
            slug: 'institution.campuses',
            name: 'Sedes',
            canCreate: false,
            canUpdate: false,
            canDelete: true,
          },
        ],
      }),
    );
    renderApp(`/security/roles/${ROLE_ID}`);
    expect(await screen.findByText(/Este rol tiene permisos que tú no tienes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar permisos' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ver: Usuarios' })).toBeDisabled();
  });

  it('muestra el 409 al borrar un rol asignado', async () => {
    mockSignedIn(makeSession(), adminMenu());
    mockRoles();
    const user = userEvent.setup();
    renderApp(`/security/roles/${ROLE_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Borrar rol' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Borrar rol' }));
    expect(await screen.findByText(/El rol está asignado a usuarios/)).toBeInTheDocument();
  });

  it('con el rol de seguridad limitado a una sede, no ofrece crear ni editar roles', async () => {
    mockSignedIn(makeSession(), securityMenu(FULL, { siteOnly: true }));
    mockRoles();
    server.use(
      http.get(apiUrl('/api/menu-options/my-menu'), () =>
        HttpResponse.json(securityMenu(FULL, { siteOnly: true })),
      ),
    );
    renderApp('/security/roles');
    await screen.findByRole('table', { name: 'Roles' });
    expect(screen.queryByRole('button', { name: 'Nuevo rol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).not.toBeInTheDocument();
  });
});

describe('roles globales (SUPER_ADMIN)', () => {
  it('la matriz usa el árbol completo, con las opciones inactivas marcadas y sin tope', async () => {
    mockSignedIn(superAdminSession());
    const global = role({ id: GLOBAL_ID, name: 'TEACHER', isGlobal: true, institutionId: null });
    server.use(
      http.get(apiUrl('/api/global-roles/:id'), () => HttpResponse.json(global)),
      http.get(apiUrl('/api/menu-options'), () =>
        HttpResponse.json([
          menuOption('academic', 'Académico', [
            menuOption('academic.grades', 'Grados', [], { isActive: false }),
          ]),
        ]),
      ),
    );
    renderApp(`/admin/global-roles/${GLOBAL_ID}`);
    expect(await screen.findByRole('heading', { name: 'Docente' })).toBeInTheDocument();
    const matrix = await screen.findByRole('table', { name: /Permisos del rol/ });
    expect(within(matrix).getByText('Inactiva')).toBeInTheDocument();
    expect(within(matrix).getByRole('checkbox', { name: 'Borrar: Grados' })).toBeEnabled();
  });
});
