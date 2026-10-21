import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Institution } from '@/api/types';
import { institution } from '@/test/fixtures';
import { apiError, apiUrl, mockSignedIn, page, superAdminSession } from '@/test/api';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const ID = '0f1e2d3c-4b5a-4697-8877-665544332211';
const NEW_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';

/** Instituciones falsas del SUPER_ADMIN. */
function mockInstitutions(rows: Institution[] = [institution({ id: ID })]) {
  const calls = {
    detail: 0,
    created: [] as unknown[],
    updated: [] as unknown[],
    toggled: [] as string[],
  };
  server.use(
    http.get(apiUrl('/api/institutions'), () => HttpResponse.json(page(rows))),
    http.get(apiUrl('/api/institutions/:id'), ({ params }) => {
      calls.detail += 1;
      const row = rows.find((r) => r.id === params.id);
      return row ? HttpResponse.json(row) : apiError(404, 'Institución no encontrada');
    }),
    http.post(apiUrl('/api/institutions'), async ({ request }) => {
      const body = (await request.json()) as Partial<Institution>;
      calls.created.push(body);
      const created = institution({ ...body, id: NEW_ID });
      rows.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl('/api/institutions/:id'), async ({ request }) => {
      const body = (await request.json()) as Partial<Institution>;
      calls.updated.push(body);
      if (body.gradingScaleMax !== undefined && body.gradingScaleMax !== 5) {
        return apiError(
          409,
          'No se puede cambiar la escala de notas: la institución ya tiene notas registradas',
        );
      }
      return HttpResponse.json(institution({ ...body, id: ID }));
    }),
    http.patch(apiUrl('/api/institutions/:id/:action'), ({ params }) => {
      calls.toggled.push(`${String(params.id)}/${String(params.action)}`);
      return HttpResponse.json(institution({ id: ID, isActive: params.action === 'activate' }));
    }),
  );
  return calls;
}

describe('instituciones (SUPER_ADMIN)', () => {
  it('el SUPER_ADMIN sin institución tiene su menú fijo y atajo en el inicio', async () => {
    mockSignedIn(superAdminSession());
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Menú principal' });
    expect(within(nav).getByRole('button', { name: 'Administración general' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Instituciones' })).toHaveAttribute(
      'href',
      '/admin/institutions',
    );
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: /Instituciones/ }),
    ).toBeInTheDocument();
  });

  it('un usuario que no es SUPER_ADMIN no ve el menú ni la página', async () => {
    mockSignedIn(makeSession(), []);
    const calls = mockInstitutions();
    renderApp('/admin/institutions');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Instituciones' })).not.toBeInTheDocument();
    expect(calls.created).toHaveLength(0);
  });

  it('crea una institución con la escala validada y abre su detalle', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitutions([]);
    const user = userEvent.setup();
    const { router } = renderApp('/admin/institutions');

    expect(await screen.findByText(/Todavía no hay instituciones/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nueva institución' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva institución' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Colegio Nuevo');
    await user.type(within(dialog).getByLabelText('NIT'), '900 1');
    await user.clear(within(dialog).getByLabelText('Aprueba con'));
    await user.type(within(dialog).getByLabelText('Aprueba con'), '6');
    await user.click(within(dialog).getByRole('button', { name: 'Crear institución' }));

    expect(
      within(dialog).getByText('Solo números, letras, puntos y guiones (sin espacios).'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('La nota para aprobar debe estar entre la mínima y la máxima.'),
    ).toBeInTheDocument();
    expect(calls.created).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('NIT'));
    await user.type(within(dialog).getByLabelText('NIT'), '900123-1');
    await user.clear(within(dialog).getByLabelText('Aprueba con'));
    await user.type(within(dialog).getByLabelText('Aprueba con'), '3,5');
    await user.click(within(dialog).getByRole('button', { name: 'Crear institución' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/admin/institutions/${NEW_ID}`);
    });
    expect(calls.created).toEqual([
      {
        name: 'Colegio Nuevo',
        nit: '900123-1',
        gradingScaleMin: 1,
        gradingScaleMax: 5,
        passingScore: 3.5,
      },
    ]);
    expect(await screen.findByRole('heading', { name: 'Colegio Nuevo' })).toBeInTheDocument();
  });

  it('en el detalle muestra el 409 de la escala y desactiva tras confirmar', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitutions();
    const user = userEvent.setup();
    renderApp(`/admin/institutions/${ID}`);

    const max = await screen.findByLabelText('Nota máxima');
    await user.clear(max);
    await user.type(max, '10');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya tiene notas registradas');

    await user.click(screen.getByRole('button', { name: 'Desactivar institución' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar institución' }));
    await waitFor(() => {
      expect(calls.toggled).toEqual([`${ID}/deactivate`]);
    });
    expect(await screen.findByText('Colegio San José quedó inactiva.')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Reactivar institución' }),
    ).toBeInTheDocument();
  });

  it('al editar envía solo los campos cambiados, y nada si no cambió ninguno', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitutions();
    const user = userEvent.setup();
    renderApp(`/admin/institutions/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('No hay cambios para guardar.')).toBeInTheDocument();
    expect(calls.updated).toHaveLength(0);

    const name = screen.getByLabelText('Nombre');
    await user.clear(name);
    await user.type(name, 'Colegio San José de la Montaña');
    // El mismo valor con coma no cuenta como cambio.
    const min = screen.getByLabelText('Nota mínima');
    await user.clear(min);
    await user.type(min, '1,0');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
    expect(calls.updated).toEqual([{ name: 'Colegio San José de la Montaña' }]);
  });

  it('un id con formato inválido responde «no encontrada» sin consultar la API', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitutions();
    renderApp('/admin/institutions/%2E%2E');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    expect(calls.detail).toBe(0);
  });

  it('una institución que no existe responde «no encontrada»', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockInstitutions();
    renderApp('/admin/institutions/5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    expect(calls.detail).toBe(1);
  });
});
