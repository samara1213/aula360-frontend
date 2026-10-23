import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AcademicYear, Course, OwnReportCard, Period, ReportCard } from '@/api/types';
import {
  academicMenu,
  apiError,
  apiUrl,
  mockSignedIn,
  page,
  peopleMenu,
  reportsMenu,
  VIEW_ONLY,
} from '@/test/api';
import { student as studentFixture } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const STAMP = '2026-04-12T15:00:00.000Z';
const Y2026 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const C601 = '6e7f8a9b-0c1d-4e2f-9a3b-4c5d6e7f8a9b';
const P1 = '9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const S1 = '3a4b5c6d-7e8f-4a9b-8c0d-1e2f3a4b5c6d';
const S2 = '4b5c6d7e-8f9a-4b0c-9d1e-2f3a4b5c6d7e';
const S3 = '5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f';
const R1 = '6d7e8f9a-0b1c-4d2e-9f3a-4b5c6d7e8f9a';
const R2 = '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b';
const BLOB_URL = 'blob:http://localhost/boletin';
const PDF_BYTES = '%PDF-1.7 boletín';

const year: AcademicYear = {
  id: Y2026,
  institutionId: 'inst-1',
  year: 2026,
  isActive: true,
  createdAt: STAMP,
};
const course: Course = {
  id: C601,
  name: '601',
  grade: { id: 'g-1', name: 'Sexto' },
  campus: { id: 'c-1', name: 'Sede Norte', isActive: true },
  academicYear: { id: Y2026, year: 2026, isActive: true },
  createdAt: STAMP,
};
const period: Period = {
  id: P1,
  academicYearId: Y2026,
  name: 'Primer periodo',
  startDate: '2000-01-10',
  endDate: '2999-12-31',
  createdAt: STAMP,
};
const card = (id: string, studentId: string, firstName: string, outdated = false): ReportCard => ({
  id,
  student: { id: studentId, firstName, lastName: 'Rojas' },
  course: { id: C601, name: '601' },
  period: { id: P1, name: 'Primer periodo' },
  finalAverage: 3.92,
  templateId: null,
  outdated,
  outdatedAt: outdated ? STAMP : null,
  generatedBy: 'user-1',
  generatedAt: STAMP,
});

function mockReports() {
  const calls = {
    listQueries: [] as URLSearchParams[],
    generated: [] as unknown[],
    batches: [] as unknown[],
    downloads: [] as string[],
    courseQueries: 0,
  };
  let pendingFinals = false;
  let abortedBatch = false;
  server.use(
    http.get(apiUrl('/api/academic-years'), () => HttpResponse.json(page([year]))),
    http.get(apiUrl('/api/courses'), () => {
      calls.courseQueries += 1;
      return HttpResponse.json(page([course]));
    }),
    http.get(apiUrl('/api/academic-years/:id/periods'), () => HttpResponse.json([period])),
    http.get(apiUrl('/api/report-cards'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.listQueries.push(params);
      const rows = [card(R1, S1, 'Mateo'), card(R2, S2, 'Sara', true)];
      return HttpResponse.json(
        page(params.get('outdated') === 'true' ? rows.filter((r) => r.outdated) : rows),
      );
    }),
    http.post(apiUrl('/api/report-cards'), async ({ request }) => {
      const body = (await request.json()) as { force?: boolean };
      calls.generated.push(body);
      if (pendingFinals && !body.force) {
        return HttpResponse.json(
          {
            statusCode: 409,
            message:
              'Faltan definitivas en: Física. Se puede generar de todos modos, con esas materias pendientes',
            code: 'REPORT_CARD_PENDING_FINALS',
          },
          { status: 409 },
        );
      }
      return HttpResponse.json(card(R1, S1, 'Mateo'), { status: 201 });
    }),
    http.post(apiUrl('/api/report-cards/batch'), async ({ request }) => {
      calls.batches.push(await request.json());
      return HttpResponse.json({
        total: 3,
        generated: 1,
        skipped: [
          {
            studentId: S2,
            firstName: 'Sara',
            lastName: 'López',
            reason: 'Faltan definitivas en: Física.',
          },
        ],
        failed: abortedBatch
          ? [{ studentId: S3 }]
          : [{ studentId: S3, firstName: 'Juan', lastName: 'Martínez' }],
      });
    }),
    http.get(apiUrl('/api/report-cards/:id/pdf'), ({ params }) => {
      calls.downloads.push(String(params.id));
      return new HttpResponse(PDF_BYTES, { headers: { 'Content-Type': 'application/pdf' } });
    }),
  );
  return {
    calls,
    withPendingFinals: () => {
      pendingFinals = true;
    },
    withAbortedBatch: () => {
      abortedBatch = true;
    },
  };
}

/** URLs blob: (jsdom no las tiene): guarda el PDF que se abrió. */
function fakeBlobUrls() {
  const blobs: Blob[] = [];
  const revoke = vi.fn();
  Object.assign(URL, {
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return BLOB_URL;
    }),
    revokeObjectURL: revoke,
  });
  return { blobs, revoke };
}

/** window.open falso: la pestaña que se abre antes de pedir el PDF. */
function fakeTab() {
  const tab = { opener: {} as unknown, closed: false, location: { href: '' }, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  return { tab, open, ...fakeBlobUrls() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const adminMenu = () => [...academicMenu(), ...reportsMenu()];
const coursePath = `/reports/report-cards?course=${C601}`;

describe('boletines del curso', () => {
  it('lista los boletines del curso en el periodo y filtra los desactualizados', async () => {
    mockSignedIn(makeSession(), adminMenu());
    const { calls } = mockReports();
    const user = userEvent.setup();
    renderApp(coursePath);

    const table = await screen.findByRole('table', {
      name: 'Boletines de 601 en Primer periodo',
    });
    expect(within(table).getByRole('rowheader', { name: 'Mateo Rojas' })).toBeInTheDocument();
    expect(within(table).getByText('Desactualizado')).toBeInTheDocument();
    expect(within(table).getAllByText('3,92')).toHaveLength(2);
    expect(calls.listQueries.at(-1)?.get('courseId')).toBe(C601);
    expect(calls.listQueries.at(-1)?.get('periodId')).toBe(P1);

    await user.click(screen.getByLabelText('Solo los desactualizados'));
    await waitFor(() => {
      expect(calls.listQueries.at(-1)?.get('outdated')).toBe('true');
    });
    // La lista se vuelve a montar al cambiar el filtro.
    await waitFor(() => {
      const rows = within(
        screen.getByRole('table', { name: 'Boletines de 601 en Primer periodo' }),
      ).getAllByRole('rowheader');
      expect(rows.map((r) => r.textContent)).toEqual(['Sara Rojas']);
    });
  });

  it('genera los del curso (con pendientes) y muestra el resumen con nombres', async () => {
    mockSignedIn(makeSession(), adminMenu());
    const { calls } = mockReports();
    const user = userEvent.setup();
    renderApp(coursePath);

    await user.click(await screen.findByRole('button', { name: 'Generar boletines del curso' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: '¿Generar los boletines de 601?',
    });
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Generar boletines' }));
    await waitFor(() => {
      expect(calls.batches).toEqual([{ courseId: C601, periodId: P1, force: true }]);
    });

    const summary = await screen.findByRole('region', { name: 'Resultado de la generación' });
    expect(within(summary).getByText('Se generaron 1 de 3 boletines.')).toBeInTheDocument();
    expect(within(summary).getByText('Sara López:')).toBeInTheDocument();
    expect(within(summary).getByText(/Faltan definitivas en: Física/)).toBeInTheDocument();
    expect(within(summary).getByText(/Juan Martínez/)).toBeInTheDocument();
  });

  it('regenerar con definitivas pendientes ofrece generarlo de todos modos', async () => {
    mockSignedIn(makeSession(), adminMenu());
    const { calls, withPendingFinals } = mockReports();
    withPendingFinals();
    const user = userEvent.setup();
    renderApp(coursePath);

    const table = await screen.findByRole('table', {
      name: 'Boletines de 601 en Primer periodo',
    });
    await user.click(
      within(table).getByRole('button', { name: 'Acciones del boletín de Mateo Rojas' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Regenerar' }));
    await user.click(await screen.findByRole('button', { name: 'Regenerar boletín' }));

    const confirm = await screen.findByRole('alertdialog', { name: 'Faltan definitivas' });
    expect(within(confirm).getByText(/Faltan definitivas en: Física/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Generar de todos modos' }));
    await waitFor(() => {
      expect(calls.generated).toEqual([
        { studentId: S1, periodId: P1 },
        { studentId: S1, periodId: P1, force: true },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('descargar pide el PDF al backend y lo abre en memoria en la pestaña nueva', async () => {
    mockSignedIn(makeSession(), adminMenu());
    const { calls } = mockReports();
    const { tab, open, blobs } = fakeTab();
    const user = userEvent.setup();
    renderApp(coursePath);

    const table = await screen.findByRole('table', {
      name: 'Boletines de 601 en Primer periodo',
    });
    await user.click(
      within(table).getByRole('button', { name: 'Acciones del boletín de Mateo Rojas' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Descargar' }));
    await waitFor(() => {
      expect(tab.location.href).toBe(BLOB_URL);
    });
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(calls.downloads).toEqual([R1]);
    // Siempre como PDF: un HTML abierto como blob correría con el origen de la app.
    expect(blobs[0]?.type).toBe('application/pdf');
    expect(await blobs[0]?.text()).toBe(PDF_BYTES);
  });

  it('con la ventana bloqueada lo descarga como archivo, sin salir de la app', async () => {
    mockSignedIn(makeSession(), adminMenu());
    mockReports();
    vi.spyOn(window, 'open').mockReturnValue(null);
    fakeBlobUrls();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    const { router } = renderApp(coursePath);

    const table = await screen.findByRole('table', {
      name: 'Boletines de 601 en Primer periodo',
    });
    await user.click(
      within(table).getByRole('button', { name: 'Acciones del boletín de Mateo Rojas' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Descargar' }));
    await waitFor(() => {
      expect(click).toHaveBeenCalled();
    });
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.href).toBe(BLOB_URL);
    expect(link.download).toBe('boletin.pdf');
    expect(router.state.location.pathname).toBe('/reports/report-cards');
  });

  it('si el backend no lo da (404), cierra la pestaña y avisa', async () => {
    mockSignedIn(makeSession(), adminMenu());
    mockReports();
    server.use(
      http.get(apiUrl('/api/report-cards/:id/pdf'), () => apiError(404, 'Boletín no encontrado')),
    );
    const { tab } = fakeTab();
    const user = userEvent.setup();
    renderApp(coursePath);

    const table = await screen.findByRole('table', {
      name: 'Boletines de 601 en Primer periodo',
    });
    await user.click(
      within(table).getByRole('button', { name: 'Acciones del boletín de Mateo Rojas' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Descargar' }));
    await waitFor(() => {
      expect(tab.close).toHaveBeenCalled();
    });
    expect(tab.location.href).toBe('');
    expect(await screen.findByText('Boletín no encontrado')).toBeInTheDocument();
  });

  it('si la masiva se corta por perder el permiso, el resumen no trae nombres', async () => {
    mockSignedIn(makeSession(), adminMenu());
    const { withAbortedBatch } = mockReports();
    withAbortedBatch();
    const user = userEvent.setup();
    renderApp(coursePath);

    await user.click(await screen.findByRole('button', { name: 'Generar boletines del curso' }));
    await user.click(await screen.findByRole('button', { name: 'Generar boletines' }));
    const summary = await screen.findByRole('region', { name: 'Resultado de la generación' });
    expect(
      within(summary).getByText(/ya no administras la sede de este curso. Quedaron 1 sin generar/),
    ).toBeInTheDocument();
    expect(within(summary).queryByText(/No se pudieron generar los de/)).not.toBeInTheDocument();
  });

  it('con solo ver Boletines no se genera ni regenera', async () => {
    mockSignedIn(makeSession(), [...academicMenu(), ...reportsMenu(VIEW_ONLY)]);
    mockReports();
    const user = userEvent.setup();
    renderApp(coursePath);

    const table = await screen.findByRole('table', {
      name: 'Boletines de 601 en Primer periodo',
    });
    expect(
      screen.queryByRole('button', { name: 'Generar boletines del curso' }),
    ).not.toBeInTheDocument();
    await user.click(
      within(table).getByRole('button', { name: 'Acciones del boletín de Mateo Rojas' }),
    );
    expect(await screen.findByRole('menuitem', { name: 'Descargar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Regenerar' })).not.toBeInTheDocument();
  });

  it('sin el permiso de Boletines la página no existe', async () => {
    mockSignedIn(makeSession(), academicMenu());
    renderApp('/reports/report-cards');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
  });
});

const mine: OwnReportCard[] = [
  {
    id: R1,
    course: { id: C601, name: '601' },
    period: { id: P1, name: 'Primer periodo' },
    finalAverage: 4.1,
    outdated: true,
    generatedAt: STAMP,
  },
];
const studentSession = () =>
  makeSession({
    institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['STUDENT'] }],
    user: { userType: 'STUDENT', firstName: 'Mateo', lastName: 'Rojas' },
  });

describe('mis boletines (estudiante)', () => {
  it('lista los suyos, avisa si uno quedó desactualizado y lo descarga', async () => {
    mockSignedIn(studentSession(), reportsMenu(VIEW_ONLY));
    const { calls } = mockReports();
    server.use(http.get(apiUrl('/api/report-cards/mine'), () => HttpResponse.json(mine)));
    const { tab } = fakeTab();
    const user = userEvent.setup();
    renderApp('/reports/report-cards');

    const list = await screen.findByRole('list', { name: 'Mis boletines' });
    // Solo sus boletines: ni la lista de la institución, ni cursos (I8 de la 3f-1).
    expect(calls.listQueries).toHaveLength(0);
    expect(calls.courseQueries).toBe(0);
    expect(within(list).getByText('Primer periodo')).toBeInTheDocument();
    expect(
      within(list).getByText(/la institución publicará una versión nueva/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Curso')).not.toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: /Descargar PDF/ }));
    await waitFor(() => {
      expect(tab.location.href).toBe(BLOB_URL);
    });
    expect(calls.downloads).toEqual([R1]);
  });

  it('sin boletines lo explica', async () => {
    mockSignedIn(studentSession(), reportsMenu(VIEW_ONLY));
    mockReports();
    server.use(http.get(apiUrl('/api/report-cards/mine'), () => HttpResponse.json([])));
    renderApp('/reports/report-cards');
    expect(await screen.findByText('Todavía no tienes boletines.')).toBeInTheDocument();
  });

  it('sin perfil de estudiante (404) también', async () => {
    mockSignedIn(studentSession(), reportsMenu(VIEW_ONLY));
    mockReports();
    server.use(
      http.get(apiUrl('/api/report-cards/mine'), () =>
        apiError(404, 'No tiene perfil de estudiante'),
      ),
    );
    renderApp('/reports/report-cards');
    expect(await screen.findByText('Todavía no tienes boletines.')).toBeInTheDocument();
  });
});

describe('boletines en la ficha del estudiante', () => {
  const studentPath = `/people/students/${studentFixture().id}`;
  const mockStudent = () => {
    server.use(
      http.get(apiUrl('/api/students/:id'), () => HttpResponse.json(studentFixture())),
      http.get(apiUrl('/api/campuses'), () => HttpResponse.json(page([]))),
    );
  };

  it('con el permiso de ver Boletines, los lista por estudiante', async () => {
    mockSignedIn(makeSession(), [...peopleMenu(), ...reportsMenu(VIEW_ONLY)]);
    const { calls } = mockReports();
    mockStudent();
    renderApp(studentPath);

    const section = await screen.findByRole('region', { name: 'Boletines' });
    expect(
      await within(section).findAllByRole('button', { name: /Descargar el boletín/ }),
    ).toHaveLength(2);
    expect(calls.listQueries.at(-1)?.get('studentId')).toBe(studentFixture().id);
  });

  it('sin el permiso no aparece ni se pide', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const { calls } = mockReports();
    mockStudent();
    renderApp(studentPath);
    expect(await screen.findByRole('heading', { name: /Mateo Rojas/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Boletines' })).not.toBeInTheDocument();
    expect(calls.listQueries).toHaveLength(0);
  });
});

describe('cambio de institución', () => {
  it('los boletines de la institución anterior no se muestran mientras cargan los de la nueva', async () => {
    const institutions = [
      { id: 'inst-1', name: 'Colegio San José', roles: ['STUDENT'] },
      { id: 'inst-2', name: 'Colegio La Esperanza', roles: ['STUDENT'] },
    ];
    let session = { ...studentSession(), institutions };
    server.use(
      http.get(apiUrl('/api/auth/me'), () => HttpResponse.json(session)),
      http.get(apiUrl('/api/menu-options/my-menu'), () =>
        HttpResponse.json(reportsMenu(VIEW_ONLY)),
      ),
      http.post(apiUrl('/api/auth/switch-institution'), () => {
        session = { ...session, activeInstitutionId: 'inst-2' };
        return HttpResponse.json(session);
      }),
    );
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(apiUrl('/api/report-cards/mine'), async () => {
        if (session.activeInstitutionId === 'inst-1') return HttpResponse.json(mine);
        await gate;
        return HttpResponse.json([
          { ...mine[0], id: R2, period: { id: P1, name: 'Periodo de La Esperanza' } },
        ]);
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/reports/report-cards');

    expect(await screen.findByText('Primer periodo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cambiar de institución/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Colegio La Esperanza' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    await router.navigate('/reports/report-cards');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Boletines', level: 1 })).toBeInTheDocument();
    });
    expect(screen.queryByText('Primer periodo')).not.toBeInTheDocument();

    release();
    expect(await screen.findByText('Periodo de La Esperanza')).toBeInTheDocument();
    expect(screen.queryByText('Primer periodo')).not.toBeInTheDocument();
  });
});
