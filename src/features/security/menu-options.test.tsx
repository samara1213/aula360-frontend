import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { parentChoices } from '@/features/security/menu-options-api';
import { apiError, apiUrl, mockSignedIn, securityMenu, superAdminSession } from '@/test/api';
import { menuOption } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const TREE = [
  menuOption('academic', 'Académico', [
    menuOption('academic.courses', 'Cursos', [menuOption('academic.courses.groups', 'Grupos')]),
  ]),
  menuOption('reports', 'Reportes', [], { isActive: false }),
];

function mockTree() {
  const calls = { created: [] as unknown[], toggled: [] as string[] };
  server.use(
    http.get(apiUrl('/api/menu-options'), () => HttpResponse.json(TREE)),
    http.post(apiUrl('/api/menu-options'), async ({ request }) => {
      const body = (await request.json()) as { slug: string };
      calls.created.push(body);
      if (body.slug === 'academic') return apiError(409, 'Ya existe una opción con ese slug');
      return HttpResponse.json(menuOption(body.slug, 'Nueva'), { status: 201 });
    }),
    http.patch(apiUrl('/api/menu-options/:id/:action'), ({ params }) => {
      calls.toggled.push(`${String(params.id)}/${String(params.action)}`);
      return HttpResponse.json(menuOption(String(params.id), 'x'));
    }),
  );
  return calls;
}

describe('opciones de menú', () => {
  it('para el administrador: el árbol de solo lectura, con las inactivas marcadas', async () => {
    mockSignedIn(makeSession(), securityMenu());
    mockTree();
    renderApp('/security/menu-options');
    const tree = await screen.findByRole('list', { name: 'Opciones del menú' });
    expect(within(tree).getByText('Grupos')).toBeInTheDocument();
    expect(within(tree).getByText('Inactiva')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva opción' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).not.toBeInTheDocument();
  });

  it('el SUPER_ADMIN crea una opción dentro de otra y ve el 409 del slug', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockTree();
    const user = userEvent.setup();
    renderApp('/admin/menu-options');

    await user.click(await screen.findByRole('button', { name: 'Acciones de Académico' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Agregar opción dentro' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva opción' });
    expect(within(dialog).getByLabelText('Dentro de')).toHaveValue('academic');
    await user.type(within(dialog).getByLabelText('Nombre'), 'Horarios');
    await user.type(within(dialog).getByLabelText('Slug'), 'Academic Horarios');
    await user.click(within(dialog).getByRole('button', { name: 'Crear opción' }));
    expect(within(dialog).getByText(/Minúsculas, números o guiones/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Slug'));
    await user.type(within(dialog).getByLabelText('Slug'), 'academic');
    await user.click(within(dialog).getByRole('button', { name: 'Crear opción' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ya existe una opción');

    await user.clear(within(dialog).getByLabelText('Slug'));
    await user.type(within(dialog).getByLabelText('Slug'), 'academic.schedules');
    await user.selectOptions(within(dialog).getByLabelText('Ícono'), 'calendar');
    await user.click(within(dialog).getByRole('button', { name: 'Crear opción' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.created.at(-1)).toEqual({
      name: 'Horarios',
      slug: 'academic.schedules',
      parentId: 'academic',
      icon: 'calendar',
      displayOrder: 0,
    });
  });

  it('un nieto no ofrece «Agregar opción dentro» (máximo 3 niveles)', async () => {
    mockSignedIn(superAdminSession());
    mockTree();
    const user = userEvent.setup();
    renderApp('/admin/menu-options');
    await user.click(await screen.findByRole('button', { name: 'Acciones de Grupos' }));
    expect(await screen.findByRole('menuitem', { name: 'Editar o mover' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Agregar opción dentro' })).toBeNull();
  });

  it('al mover, no ofrece su propia rama ni padres que pasen de 3 niveles', () => {
    const [academic] = TREE;
    const courses = academic?.children[0];
    if (!courses) throw new Error('árbol');
    // Cursos tiene un hijo (altura 2): solo puede quedar en la raíz o bajo un primer nivel.
    expect(parentChoices(TREE, courses).map(({ node }) => node.id)).toEqual([
      'academic',
      'reports',
    ]);
    // Una opción nueva puede ir bajo cualquiera de los dos primeros niveles.
    expect(parentChoices(TREE).map(({ node }) => node.id)).toEqual([
      'academic',
      'academic.courses',
      'reports',
    ]);
  });
});
