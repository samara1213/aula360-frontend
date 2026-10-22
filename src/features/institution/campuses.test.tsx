import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Campus } from '@/api/types';
import { apiError, apiUrl, institutionMenu, mockSignedIn, page, VIEW_ONLY } from '@/test/api';
import { campus } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

/** Sedes falsas: guarda las consultas y lo que llega en POST y PATCH. */
function mockCampuses(rows: Campus[] = [campus()]) {
  const calls = {
    queries: [] as URLSearchParams[],
    created: [] as unknown[],
    patched: [] as string[],
  };
  server.use(
    http.get(apiUrl('/api/campuses'), ({ request }) => {
      calls.queries.push(new URL(request.url).searchParams);
      return HttpResponse.json(page(rows));
    }),
    http.post(apiUrl('/api/campuses'), async ({ request }) => {
      const body = (await request.json()) as Partial<Campus>;
      calls.created.push(body);
      if (body.name === 'Repetida')
        return apiError(409, 'Ya existe una sede con ese nombre en la institución');
      const created = campus({ ...body, id: 'c-new' });
      rows.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl('/api/campuses/:id/:action'), ({ params }) => {
      calls.patched.push(`${String(params.id)}/${String(params.action)}`);
      const row = rows.find((r) => r.id === params.id);
      if (!row) return apiError(404, 'Sede no encontrada');
      row.isActive = params.action === 'activate';
      return HttpResponse.json(row);
    }),
  );
  return calls;
}

describe('sedes', () => {
  it('lista las sedes y guarda la búsqueda y el estado en la URL', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    const calls = mockCampuses();
    const user = userEvent.setup();
    const { router } = renderApp('/institution/campuses');

    expect(await screen.findByRole('heading', { name: 'Sedes' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Sedes' });
    expect(within(table).getByRole('rowheader', { name: 'Sede Principal' })).toBeInTheDocument();
    expect(calls.queries[0]?.get('isActive')).toBe('true');

    await user.type(screen.getByLabelText('Buscar'), 'norte');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?search=norte');
    });
    await waitFor(() => {
      expect(calls.queries.at(-1)?.get('search')).toBe('norte');
    });

    await user.selectOptions(screen.getByLabelText('Estado'), 'all');
    expect(router.state.location.search).toBe('?search=norte&status=all');
    await waitFor(() => {
      expect(calls.queries.at(-1)?.has('isActive')).toBe(false);
    });
  });

  it('una página por encima del máximo del backend se pide como la 10 000', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    const calls = mockCampuses();
    renderApp('/institution/campuses?page=99999');
    await screen.findByRole('heading', { name: 'Sedes' });
    await waitFor(() => {
      expect(calls.queries[0]?.get('page')).toBe('10000');
    });
  });

  it('lee los filtros de la URL e ignora los valores inválidos', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    const calls = mockCampuses();
    renderApp('/institution/campuses?page=-3&status=raro&search=sur');
    await screen.findByRole('table', { name: 'Sedes' });
    const query = calls.queries[0];
    expect(query?.get('page')).toBe('1');
    expect(query?.get('isActive')).toBe('true');
    expect(query?.get('search')).toBe('sur');
    expect(screen.getByLabelText('Buscar')).toHaveValue('sur');
  });

  it('crea una sede: valida, guarda los opcionales vacíos como null y recarga la lista', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    const calls = mockCampuses();
    const user = userEvent.setup();
    renderApp('/institution/campuses');

    await user.click(await screen.findByRole('button', { name: 'Nueva sede' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sede' });
    await user.click(within(dialog).getByRole('button', { name: 'Crear sede' }));
    expect(within(dialog).getByText('Escribe el nombre de la sede.')).toBeInTheDocument();
    expect(calls.created).toHaveLength(0);

    await user.type(within(dialog).getByLabelText('Nombre'), '  Sede Norte ');
    await user.click(within(dialog).getByRole('button', { name: 'Crear sede' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.created).toEqual([{ name: 'Sede Norte', address: null, city: null }]);
    expect(await screen.findByText('«Sede Norte» creada.')).toBeInTheDocument();
    expect(await screen.findByRole('rowheader', { name: 'Sede Norte' })).toBeInTheDocument();
  });

  it('muestra el error del backend (nombre repetido) dentro del diálogo', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    mockCampuses();
    const user = userEvent.setup();
    renderApp('/institution/campuses');

    await user.click(await screen.findByRole('button', { name: 'Nueva sede' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sede' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Repetida');
    await user.click(within(dialog).getByRole('button', { name: 'Crear sede' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Ya existe una sede con ese nombre',
    );
  });

  it('desactiva una sede después de confirmar', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    const calls = mockCampuses();
    const user = userEvent.setup();
    renderApp('/institution/campuses');

    const table = await screen.findByRole('table', { name: 'Sedes' });
    await user.click(within(table).getByRole('button', { name: 'Acciones de Sede Principal' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Desactivar' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: '¿Desactivar «Sede Principal»?',
    });
    expect(calls.patched).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar sede' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(calls.patched).toEqual(['c-1/deactivate']);
    expect(await screen.findByText('«Sede Principal» quedó inactiva.')).toBeInTheDocument();
  });

  it('solo con permiso de ver: sin «Nueva sede» ni acciones por fila', async () => {
    mockSignedIn(makeSession(), institutionMenu(VIEW_ONLY, VIEW_ONLY));
    mockCampuses();
    renderApp('/institution/campuses');
    await screen.findByRole('table', { name: 'Sedes' });
    expect(screen.queryByRole('button', { name: 'Nueva sede' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).not.toBeInTheDocument();
  });

  it('con un rol limitado a una sede: ve las sedes, pero no crea, edita ni desactiva', async () => {
    // El backend exige alcance de toda la institución para esas acciones (B3 de 3b-1).
    mockSignedIn(makeSession(), institutionMenu(undefined, undefined, { siteOnly: true }));
    mockCampuses();
    renderApp('/institution/campuses');
    await screen.findByRole('table', { name: 'Sedes' });
    expect(screen.queryByRole('button', { name: 'Nueva sede' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).not.toBeInTheDocument();
  });

  it('sin la opción en el menú responde «no encontrada» y no consulta la API', async () => {
    mockSignedIn(makeSession(), []);
    const calls = mockCampuses();
    renderApp('/institution/campuses');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    expect(calls.queries).toHaveLength(0);
  });

  it('una página que ya no existe lleva a la última', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    server.use(
      http.get(apiUrl('/api/campuses'), ({ request }) => {
        const requested = Number(new URL(request.url).searchParams.get('page'));
        // 25 sedes: 2 páginas. La 5 llega vacía, con meta.page 5.
        return HttpResponse.json(
          page(
            requested > 2 ? [] : [campus({ name: `Sede ${String(requested)}` })],
            requested,
            20,
            25,
          ),
        );
      }),
    );
    const { router } = renderApp('/institution/campuses?page=5');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2');
    });
    expect(await screen.findByRole('rowheader', { name: 'Sede 2' })).toBeInTheDocument();
  });
});
