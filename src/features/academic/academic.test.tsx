import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AcademicYear, CatalogItem, PerformanceLevels, Period } from '@/api/types';
import {
  academicMenu,
  apiError,
  apiUrl,
  FULL,
  menuNode,
  mockSignedIn,
  NO_ACCESS,
  page,
  VIEW_ONLY,
} from '@/test/api';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const Y2026 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const Y2025 = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const STAMP = '2026-01-10T15:00:00.000Z';

const year = (id: string, value: number, isActive = true): AcademicYear => ({
  id,
  institutionId: 'i-1',
  year: value,
  isActive,
  createdAt: STAMP,
});

const period = (id: string, name: string, startDate: string, endDate: string): Period => ({
  id,
  academicYearId: Y2026,
  name,
  startDate,
  endDate,
  createdAt: STAMP,
});

/** Años y periodos falsos: guarda lo que llega en POST, PATCH y DELETE. */
function mockYears(years: AcademicYear[] = [year(Y2026, 2026), year(Y2025, 2025, false)]) {
  const periods: Period[] = [period('p-1', 'Primer periodo', '2026-02-02', '2026-04-10')];
  const calls = {
    queries: [] as URLSearchParams[],
    created: [] as unknown[],
    patched: [] as unknown[],
    periodsCreated: [] as unknown[],
    periodsPatched: [] as unknown[],
  };
  server.use(
    http.get(apiUrl('/api/academic-years'), ({ request }) => {
      calls.queries.push(new URL(request.url).searchParams);
      return HttpResponse.json(page(years));
    }),
    http.get(apiUrl('/api/academic-years/:id'), ({ params }) => {
      const found = years.find((y) => y.id === params.id);
      return found ? HttpResponse.json(found) : apiError(404, 'Año lectivo no encontrado');
    }),
    http.post(apiUrl('/api/academic-years'), async ({ request }) => {
      const body = (await request.json()) as { year: number };
      calls.created.push(body);
      if (years.some((y) => y.year === body.year))
        return apiError(409, 'Ya existe ese año lectivo en la institución');
      const created = year('3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', body.year);
      years.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl('/api/academic-years/:id'), async ({ params, request }) => {
      const body = (await request.json()) as Partial<AcademicYear>;
      calls.patched.push(body);
      const found = years.find((y) => y.id === params.id);
      if (!found) return apiError(404, 'Año lectivo no encontrado');
      Object.assign(found, body);
      return HttpResponse.json(found);
    }),
    http.delete(apiUrl('/api/academic-years/:id'), () =>
      apiError(409, 'El año lectivo tiene periodos, cursos o matrículas: no se puede borrar'),
    ),
    http.get(apiUrl('/api/academic-years/:id/periods'), ({ params }) =>
      HttpResponse.json(params.id === Y2026 ? periods : []),
    ),
    http.post(apiUrl('/api/academic-years/:id/periods'), async ({ request }) => {
      const body = (await request.json()) as Period;
      calls.periodsCreated.push(body);
      if (body.name === 'Cruzado')
        return apiError(409, 'Las fechas se cruzan con otro periodo del año lectivo');
      const created = period('p-new', body.name, body.startDate, body.endDate);
      periods.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl('/api/periods/:id'), async ({ params, request }) => {
      const body = (await request.json()) as Partial<Period>;
      calls.periodsPatched.push(body);
      const found = periods.find((p) => p.id === params.id);
      if (!found) return apiError(404, 'Periodo no encontrado');
      Object.assign(found, body);
      return HttpResponse.json(found);
    }),
  );
  return calls;
}

describe('años lectivos', () => {
  it('lista los años y filtra por estado', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const calls = mockYears();
    const user = userEvent.setup();
    const { router } = renderApp('/academic/years');

    const table = await screen.findByRole('table', { name: 'Años lectivos' });
    expect(within(table).getByRole('link', { name: '2026' })).toHaveAttribute(
      'href',
      `/academic/years/${Y2026}`,
    );
    expect(calls.queries[0]?.has('isActive')).toBe(false);
    // Los años no tienen búsqueda: el backend rechazaría `search`.
    expect(calls.queries[0]?.has('search')).toBe(false);

    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive');
    expect(router.state.location.search).toBe('?status=inactive');
    await waitFor(() => {
      expect(calls.queries.at(-1)?.get('isActive')).toBe('false');
    });
  });

  it('crea un año y muestra el error de un año repetido', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const calls = mockYears();
    const user = userEvent.setup();
    renderApp('/academic/years');

    await user.click(await screen.findByRole('button', { name: 'Nuevo año lectivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo año lectivo' });
    const input = within(dialog).getByLabelText('Año');
    await user.clear(input);
    await user.type(input, '1999');
    await user.click(within(dialog).getByRole('button', { name: 'Crear año' }));
    expect(await within(dialog).findByText('Entre 2000 y 2100.')).toBeInTheDocument();
    expect(calls.created).toEqual([]);

    await user.clear(input);
    await user.type(input, '2026');
    await user.click(within(dialog).getByRole('button', { name: 'Crear año' }));
    expect(
      await within(dialog).findByText('Ya existe ese año lectivo en la institución'),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '2027');
    await user.click(within(dialog).getByRole('button', { name: 'Crear año' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.created.at(-1)).toEqual({ year: 2027 });
    expect(
      await within(screen.getByRole('table', { name: 'Años lectivos' })).findByRole('link', {
        name: '2027',
      }),
    ).toBeInTheDocument();
  });

  it('desactiva un año con confirmación y avisa si no se puede eliminar', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const calls = mockYears();
    const user = userEvent.setup();
    renderApp('/academic/years');

    await user.click(
      within(await screen.findByRole('table')).getByRole('button', {
        name: 'Acciones del año 2026',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Desactivar el año 2026?' });
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar año' }));
    expect(await screen.findByText('El año 2026 quedó inactivo.')).toBeInTheDocument();
    expect(calls.patched).toEqual([{ isActive: false }]);

    await user.click(
      within(await screen.findByRole('table')).getByRole('button', {
        name: 'Acciones del año 2025',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    const remove = await screen.findByRole('alertdialog', { name: '¿Eliminar el año 2025?' });
    await user.click(within(remove).getByRole('button', { name: 'Eliminar año' }));
    expect(
      await screen.findByText(
        'El año lectivo tiene periodos, cursos o matrículas: no se puede borrar',
      ),
    ).toBeInTheDocument();
  });

  it('eliminar desde la ficha vuelve al listado sin mostrar «no encontrado»', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const years = [year(Y2026, 2026), year(Y2025, 2025, false)];
    mockYears(years);
    const detailRequests: string[] = [];
    server.use(
      http.get(apiUrl('/api/academic-years/:id'), ({ params }) => {
        detailRequests.push(String(params.id));
        const found = years.find((y) => y.id === params.id);
        return found ? HttpResponse.json(found) : apiError(404, 'Año lectivo no encontrado');
      }),
      http.delete(apiUrl('/api/academic-years/:id'), ({ params }) => {
        years.splice(
          years.findIndex((y) => y.id === params.id),
          1,
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { router, queryClient } = renderApp(`/academic/years/${Y2025}`);

    await screen.findByRole('heading', { name: 'Año lectivo 2025' });
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Eliminar el año 2025?' });
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar año' }));

    expect(await screen.findByText('El año 2025 se eliminó.')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/academic/years');
    });
    expect(screen.queryByText(/no encontrad/i)).not.toBeInTheDocument();
    // La ficha borrada no se volvió a pedir y ya no está en la caché.
    expect(detailRequests).toEqual([Y2025]);
    await waitFor(() => {
      expect(
        queryClient
          .getQueryCache()
          .findAll({ queryKey: ['academic', 'inst-1', 'years', 'detail'] }),
      ).toEqual([]);
    });
  });

  it('sin el permiso en toda la institución, solo lectura', async () => {
    mockSignedIn(makeSession(), academicMenu(undefined, { siteOnly: true }));
    mockYears();
    renderApp('/academic/years');

    await screen.findByRole('table', { name: 'Años lectivos' });
    expect(screen.queryByRole('button', { name: 'Nuevo año lectivo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acciones del año 2026' })).not.toBeInTheDocument();
  });
});

describe('periodos', () => {
  it('la ficha del año muestra sus periodos y valida las fechas antes de enviar', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const calls = mockYears();
    const user = userEvent.setup();
    renderApp(`/academic/years/${Y2026}`);

    expect(await screen.findByRole('heading', { name: 'Año lectivo 2026' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Periodos de 2026' });
    expect(within(table).getByRole('rowheader', { name: 'Primer periodo' })).toBeInTheDocument();
    // Sin correrse un día por la zona horaria.
    expect(within(table).getByText('2/02/2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nuevo periodo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo periodo' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Segundo periodo');
    await user.type(within(dialog).getByLabelText('Inicio'), '2025-04-20');
    await user.type(within(dialog).getByLabelText('Fin'), '2028-01-10');
    await user.click(within(dialog).getByRole('button', { name: 'Crear periodo' }));
    expect(await within(dialog).findByText('Debe empezar dentro de 2026.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Debe terminar a más tardar el/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Inicio'));
    await user.type(within(dialog).getByLabelText('Inicio'), '2026-06-20');
    await user.clear(within(dialog).getByLabelText('Fin'));
    await user.type(within(dialog).getByLabelText('Fin'), '2026-04-20');
    await user.click(within(dialog).getByRole('button', { name: 'Crear periodo' }));
    expect(
      await within(dialog).findByText('No puede ser anterior a la fecha de inicio.'),
    ).toBeInTheDocument();
    expect(calls.periodsCreated).toEqual([]);

    await user.clear(within(dialog).getByLabelText('Fin'));
    await user.type(within(dialog).getByLabelText('Fin'), '2026-08-28');
    await user.click(within(dialog).getByRole('button', { name: 'Crear periodo' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.periodsCreated).toEqual([
      { name: 'Segundo periodo', startDate: '2026-06-20', endDate: '2026-08-28' },
    ]);
    expect(await within(table).findByRole('rowheader', { name: 'Segundo periodo' })).toBeVisible();
  });

  it('muestra el cruce de fechas que responde el backend y al editar envía solo lo que cambió', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const calls = mockYears();
    const user = userEvent.setup();
    renderApp(`/academic/years/${Y2026}`);

    await user.click(await screen.findByRole('button', { name: 'Nuevo periodo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo periodo' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Cruzado');
    await user.type(within(dialog).getByLabelText('Inicio'), '2026-03-01');
    await user.type(within(dialog).getByLabelText('Fin'), '2026-05-01');
    await user.click(within(dialog).getByRole('button', { name: 'Crear periodo' }));
    expect(
      await within(dialog).findByText('Las fechas se cruzan con otro periodo del año lectivo'),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(
      within(await screen.findByRole('table')).getByRole('button', {
        name: 'Acciones de Primer periodo',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const edit = await screen.findByRole('dialog', { name: 'Editar periodo' });
    await user.clear(within(edit).getByLabelText('Fin'));
    await user.type(within(edit).getByLabelText('Fin'), '2026-04-17');
    await user.click(within(edit).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => {
      expect(calls.periodsPatched).toEqual([{ endDate: '2026-04-17' }]);
    });
  });

  it('la pantalla de periodos elige el año activo y guarda el elegido en la URL', async () => {
    mockSignedIn(makeSession(), academicMenu());
    mockYears([year(Y2025, 2025, false), year(Y2026, 2026)]);
    const user = userEvent.setup();
    const { router } = renderApp('/academic/periods');

    const select = await screen.findByLabelText('Año lectivo');
    expect(select).toHaveValue(Y2026);
    expect(await screen.findByRole('table', { name: 'Periodos de 2026' })).toBeInTheDocument();

    await user.selectOptions(select, Y2025);
    expect(router.state.location.search).toBe(`?year=${Y2025}`);
    expect(await screen.findByText('Este año todavía no tiene periodos.')).toBeInTheDocument();
  });

  it('sin el permiso de ver Años lectivos no pide la lista y explica por qué', async () => {
    mockSignedIn(makeSession(), [
      menuNode('academic', 'Académico', VIEW_ONLY, [
        menuNode('academic.years', 'Años lectivos', NO_ACCESS),
        menuNode('academic.periods', 'Periodos', FULL),
      ]),
    ]);
    const calls = mockYears();
    renderApp('/academic/periods');

    expect(
      await screen.findByText(/necesitas también el permiso de ver Años lectivos/),
    ).toBeInTheDocument();
    expect(calls.queries).toEqual([]);
  });

  it('sin permiso para crear años, no enlaza a crearlos', async () => {
    mockSignedIn(makeSession(), academicMenu(undefined, { siteOnly: true }));
    mockYears([]);
    renderApp('/academic/periods');
    expect(
      await screen.findByText(/Cuando la institución cree su año lectivo/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Crea el año lectivo primero' }),
    ).not.toBeInTheDocument();
  });

  it('sin años, invita a crear el primero', async () => {
    mockSignedIn(makeSession(), academicMenu());
    mockYears([]);
    renderApp('/academic/periods');
    expect(await screen.findByText('Todavía no hay años lectivos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crea el año lectivo primero' })).toHaveAttribute(
      'href',
      '/academic/years',
    );
  });
});

/** Grados o materias falsos. */
function mockCatalog(path: '/api/grades' | '/api/subjects', rows: CatalogItem[]) {
  const calls = {
    queries: [] as URLSearchParams[],
    saved: [] as unknown[],
    deleted: [] as string[],
  };
  server.use(
    http.get(apiUrl(path), ({ request }) => {
      calls.queries.push(new URL(request.url).searchParams);
      return HttpResponse.json(page(rows));
    }),
    http.post(apiUrl(path), async ({ request }) => {
      const body = (await request.json()) as { name: string };
      calls.saved.push(body);
      const created = {
        id: `n-${String(rows.length)}`,
        institutionId: 'i-1',
        name: body.name,
        createdAt: STAMP,
      };
      rows.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl(`${path}/:id`), async ({ params, request }) => {
      const body = (await request.json()) as { name: string };
      calls.saved.push({ id: params.id, ...body });
      if (body.name === 'Repetido')
        return apiError(409, 'Ya existe un grado con ese nombre en la institución');
      const found = rows.find((r) => r.id === params.id);
      if (!found) return apiError(404, 'Grado no encontrado');
      found.name = body.name;
      return HttpResponse.json(found);
    }),
    http.delete(apiUrl(`${path}/:id`), ({ params }) => {
      calls.deleted.push(String(params.id));
      return apiError(409, 'El grado tiene cursos: no se puede borrar');
    }),
  );
  return calls;
}

const item = (id: string, name: string): CatalogItem => ({
  id,
  institutionId: 'i-1',
  name,
  createdAt: STAMP,
});

describe('grados y materias', () => {
  it('grados: busca sin enviar estado, crea, renombra y explica por qué no se elimina', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const calls = mockCatalog('/api/grades', [item('g-1', 'Sexto'), item('g-2', 'Séptimo')]);
    const user = userEvent.setup();
    renderApp('/academic/grades');

    const table = await screen.findByRole('table', { name: 'Grados' });
    expect(within(table).getByRole('rowheader', { name: 'Sexto' })).toBeInTheDocument();
    // Grados y materias no tienen estado: el backend rechazaría `isActive`.
    expect(calls.queries[0]?.has('isActive')).toBe(false);

    await user.type(screen.getByLabelText('Buscar'), 'sex');
    await waitFor(() => {
      expect(calls.queries.at(-1)?.get('search')).toBe('sex');
    });

    await user.click(screen.getByRole('button', { name: 'Nuevo grado' }));
    let dialog = await screen.findByRole('dialog', { name: 'Nuevo grado' });
    await user.click(within(dialog).getByRole('button', { name: 'Crear grado' }));
    expect(await within(dialog).findByText('Escribe el nombre del grado.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Nombre'), '  Octavo ');
    await user.click(within(dialog).getByRole('button', { name: 'Crear grado' }));
    expect(await screen.findByText('«Octavo» creado.')).toBeInTheDocument();
    expect(calls.saved).toEqual([{ name: 'Octavo' }]);

    await user.click(
      within(await screen.findByRole('table')).getByRole('button', { name: 'Acciones de Sexto' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Cambiar el nombre' }));
    dialog = await screen.findByRole('dialog', { name: 'Cambiar el nombre' });
    await user.clear(within(dialog).getByLabelText('Nombre'));
    await user.type(within(dialog).getByLabelText('Nombre'), 'Repetido');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(
      await within(dialog).findByText('Ya existe un grado con ese nombre en la institución'),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(
      within(await screen.findByRole('table')).getByRole('button', { name: 'Acciones de Séptimo' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Eliminar «Séptimo»?' });
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar grado' }));
    expect(
      await screen.findByText('El grado tiene cursos: no se puede borrar'),
    ).toBeInTheDocument();
    expect(calls.deleted).toEqual(['g-2']);
  });

  it('materias: usa su propio endpoint y, solo con permiso de ver, no ofrece acciones', async () => {
    mockSignedIn(makeSession(), academicMenu(VIEW_ONLY));
    mockCatalog('/api/subjects', [item('s-1', 'Matemáticas')]);
    renderApp('/academic/subjects');

    const table = await screen.findByRole('table', { name: 'Materias' });
    expect(within(table).getByRole('rowheader', { name: 'Matemáticas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva materia' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Acciones de Matemáticas' }),
    ).not.toBeInTheDocument();
  });
});

const LEVELS: PerformanceLevels = {
  scale: { min: 1, max: 5, passingScore: 3 },
  levels: [
    { id: 'l-1', name: 'Bajo', minScore: 1, maxScore: 2.99, displayOrder: 1 },
    { id: 'l-2', name: 'Básico', minScore: 3, maxScore: 3.99, displayOrder: 2 },
    { id: 'l-3', name: 'Alto', minScore: 4, maxScore: 4.59, displayOrder: 3 },
    { id: 'l-4', name: 'Superior', minScore: 4.6, maxScore: 5, displayOrder: 4 },
  ],
};

function mockLevels() {
  const calls = { replaced: [] as unknown[] };
  server.use(
    http.get(apiUrl('/api/performance-levels'), () => HttpResponse.json(LEVELS)),
    http.put(apiUrl('/api/performance-levels'), async ({ request }) => {
      const body = (await request.json()) as {
        levels: { name: string; minScore: number; maxScore: number }[];
      };
      calls.replaced.push(body);
      return HttpResponse.json({
        scale: LEVELS.scale,
        levels: body.levels.map((l, i) => ({ ...l, id: `n-${String(i)}`, displayOrder: i + 1 })),
      });
    }),
  );
  return calls;
}

describe('niveles de desempeño', () => {
  it('valida la cobertura de la escala antes de enviar y guarda con coma decimal', async () => {
    mockSignedIn(makeSession(), academicMenu());
    const calls = mockLevels();
    const user = userEvent.setup();
    renderApp('/academic/performance-levels');

    expect(await screen.findByText(/Escala de 1,0 a 5,0; se aprueba con 3,0/)).toBeInTheDocument();
    const minimums = screen.getAllByLabelText('Desde');
    expect(minimums).toHaveLength(4);
    expect(minimums[3]).toHaveValue('4,60');

    // Superior empieza en 4,7: deja un hueco con Alto.
    const superiorMin = minimums[3];
    if (!superiorMin) throw new Error('falta la fila');
    await user.clear(superiorMin);
    await user.type(superiorMin, '4,7');
    await user.click(screen.getByRole('button', { name: 'Guardar niveles' }));
    expect(
      await screen.findByText('Debe empezar en 4,60: deja un hueco con Alto.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Los niveles deben cubrir de 1,00 a 5,00 sin huecos ni cruces.'),
    ).toBeInTheDocument();
    expect(calls.replaced).toEqual([]);

    await user.clear(superiorMin);
    await user.type(superiorMin, '4,6');
    await user.click(screen.getByRole('button', { name: 'Guardar niveles' }));
    expect(await screen.findByText('Niveles guardados.')).toBeInTheDocument();
    expect(calls.replaced).toEqual([
      {
        levels: [
          { name: 'Bajo', minScore: 1, maxScore: 2.99 },
          { name: 'Básico', minScore: 3, maxScore: 3.99 },
          { name: 'Alto', minScore: 4, maxScore: 4.59 },
          { name: 'Superior', minScore: 4.6, maxScore: 5 },
        ],
      },
    ]);
  });

  it('agrega y quita niveles', async () => {
    mockSignedIn(makeSession(), academicMenu());
    mockLevels();
    const user = userEvent.setup();
    renderApp('/academic/performance-levels');

    await user.click(await screen.findByRole('button', { name: 'Agregar nivel' }));
    expect(screen.getAllByLabelText('Nombre')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Quitar Nivel 5' }));
    await user.click(screen.getByRole('button', { name: 'Quitar Superior' }));
    expect(screen.getAllByLabelText('Nombre')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Guardar niveles' }));
    expect(await screen.findByText('El último nivel termina en 5,00.')).toBeInTheDocument();
  });

  it('sin el permiso en toda la institución, solo muestra la tabla', async () => {
    mockSignedIn(makeSession(), academicMenu(undefined, { siteOnly: true }));
    mockLevels();
    renderApp('/academic/performance-levels');

    const table = await screen.findByRole('table', { name: 'Niveles de desempeño' });
    expect(within(table).getByRole('rowheader', { name: 'Superior' })).toBeInTheDocument();
    expect(within(table).getByText('4,60')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar niveles' })).not.toBeInTheDocument();
  });
});

describe('cambio de institución', () => {
  it('los grados de la institución anterior no se muestran mientras cargan los de la nueva', async () => {
    const institutions = [
      { id: 'inst-1', name: 'Colegio San José', roles: ['INSTITUTION_ADMIN'] },
      { id: 'inst-2', name: 'Colegio La Esperanza', roles: ['INSTITUTION_ADMIN'] },
    ];
    let session = makeSession({ institutions });
    server.use(
      http.get(apiUrl('/api/auth/me'), () => HttpResponse.json(session)),
      http.get(apiUrl('/api/menu-options/my-menu'), () => HttpResponse.json(academicMenu())),
      http.post(apiUrl('/api/auth/switch-institution'), () => {
        session = makeSession({ institutions, activeInstitutionId: 'inst-2' });
        return HttpResponse.json(session);
      }),
    );
    // Los grados de inst-2 tardan hasta que la prueba los suelte.
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(apiUrl('/api/grades'), async () => {
        if (session.activeInstitutionId === 'inst-1')
          return HttpResponse.json(page([item('g-a', 'Sexto A de San José')]));
        await gate;
        return HttpResponse.json(page([item('g-b', 'Primero de La Esperanza')]));
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/academic/grades');

    expect(
      await within(await screen.findByRole('table', { name: 'Grados' })).findByRole('rowheader', {
        name: 'Sexto A de San José',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cambiar de institución/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Colegio La Esperanza' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    await router.navigate('/academic/grades');

    // La lista de la institución nueva sigue cargando: ninguna fila de la anterior como marcador.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Grados' })).toBeInTheDocument();
      expect(screen.getByLabelText('Cargando Grados')).toBeInTheDocument();
    });
    expect(screen.queryByText('Sexto A de San José')).not.toBeInTheDocument();

    release();
    expect(
      await within(await screen.findByRole('table', { name: 'Grados' })).findByRole('rowheader', {
        name: 'Primero de La Esperanza',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sexto A de San José')).not.toBeInTheDocument();
  });
});
