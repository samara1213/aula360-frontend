import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReportTemplate } from '@/api/types';
import { apiError, apiUrl, mockSignedIn, superAdminSession } from '@/test/api';
import { institution } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const ID = '0f1e2d3c-4b5a-4697-8877-665544332211';
const T1 = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const T2 = '3b4c5d6e-7f8a-4b9c-8d1e-2f3a4b5c6d7e';
const NEW_ID = '4c5d6e7f-8a9b-4c0d-9e1f-3a4b5c6d7e8f';
const BLOB_URL = 'blob:http://localhost/vista-previa';
const PDF_BYTES = '%PDF-1.7 vista previa';
const path = `/admin/institutions/${ID}?tab=templates`;

function template(overrides: Partial<ReportTemplate> = {}): ReportTemplate {
  return {
    id: T1,
    name: 'Boletín 2026',
    description: 'Con el escudo a color',
    isActive: false,
    contentSha256: 'a'.repeat(64),
    createdBy: null,
    createdAt: '2026-10-20T15:00:00.000Z',
    ...overrides,
  };
}

/** Plantillas de la institución, con lo que se pidió al backend. */
function mockTemplates(initial: ReportTemplate[] = [template()]) {
  const calls = {
    uploads: [] as Record<string, string>[],
    activated: [] as string[],
    deactivated: [] as string[],
    deleted: [] as string[],
    previews: [] as string[],
  };
  let templates = initial;
  server.use(
    http.get(apiUrl('/api/institutions/:id'), () => HttpResponse.json(institution({ id: ID }))),
    http.get(apiUrl('/api/institutions/:id/report-card-templates'), () =>
      HttpResponse.json(templates),
    ),
    http.post(apiUrl('/api/institutions/:id/report-card-templates'), async ({ request }) => {
      const form = await request.formData();
      const file = form.get('file');
      calls.uploads.push({
        name: field(form, 'name'),
        description: field(form, 'description'),
        // File de otro entorno (jsdom y undici): no sirve instanceof y pierde el
        // nombre (el nombre se prueba en e2e/report-templates.spec.ts).
        file: file !== null && typeof file !== 'string' ? await file.text() : '',
      });
      const created = template({ id: NEW_ID, name: field(form, 'name') });
      templates = [created, ...templates];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.get(apiUrl('/api/institutions/:id/report-card-templates/system/preview'), () => {
      calls.previews.push('system');
      return new HttpResponse(PDF_BYTES, { headers: { 'Content-Type': 'application/pdf' } });
    }),
    http.get(apiUrl('/api/institutions/:id/report-card-templates/:tid/preview'), ({ params }) => {
      calls.previews.push(String(params.tid));
      return new HttpResponse(PDF_BYTES, { headers: { 'Content-Type': 'application/pdf' } });
    }),
    http.patch(
      apiUrl('/api/institutions/:id/report-card-templates/:tid/activate'),
      ({ params }) => {
        calls.activated.push(String(params.tid));
        templates = templates.map((t) => ({ ...t, isActive: t.id === params.tid }));
        return HttpResponse.json(templates.find((t) => t.id === params.tid));
      },
    ),
    http.patch(
      apiUrl('/api/institutions/:id/report-card-templates/:tid/deactivate'),
      ({ params }) => {
        calls.deactivated.push(String(params.tid));
        templates = templates.map((t) => (t.id === params.tid ? { ...t, isActive: false } : t));
        return HttpResponse.json(templates.find((t) => t.id === params.tid));
      },
    ),
    http.delete(apiUrl('/api/institutions/:id/report-card-templates/:tid'), ({ params }) => {
      calls.deleted.push(String(params.tid));
      templates = templates.filter((t) => t.id !== params.tid);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

const field = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
};

/** Las filas de la lista de plantillas (la del sistema primero). */
function rows(list: HTMLElement) {
  const items = within(list).getAllByRole('listitem');
  return (index: number) => {
    const item = items[index];
    if (!item) throw new Error('sin fila ' + String(index));
    return item;
  };
}

function fileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('sin input de archivo');
  return input;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('plantillas del boletín (SUPER_ADMIN)', () => {
  it('lista la del sistema en uso y las subidas; la pestaña va en la URL', async () => {
    mockSignedIn(superAdminSession());
    mockTemplates();
    const user = userEvent.setup();
    const { router } = renderApp(`/admin/institutions/${ID}`);

    await user.click(await screen.findByRole('tab', { name: 'Boletín' }));
    expect(router.state.location.search).toBe('?tab=templates');
    const list = await screen.findByRole('list', { name: 'Plantillas' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    const row = rows(list);
    expect(within(row(0)).getByText('Plantilla del sistema')).toBeInTheDocument();
    expect(within(row(0)).getByText('En uso')).toBeInTheDocument();
    expect(within(row(1)).getByText('Boletín 2026')).toBeInTheDocument();
    expect(within(row(1)).getByText('Con el escudo a color')).toBeInTheDocument();
    expect(within(row(1)).queryByText('En uso')).not.toBeInTheDocument();
    expect(screen.getByText('Variables disponibles')).toBeInTheDocument();
  });

  it('quien no es SUPER_ADMIN ve «no encontrada» y no pide las plantillas', async () => {
    mockSignedIn(makeSession());
    let requests = 0;
    server.use(
      http.get(apiUrl('/api/institutions/:id/report-card-templates'), () => {
        requests += 1;
        return HttpResponse.json([]);
      }),
    );
    renderApp(path);

    expect(await screen.findByText('No encontramos esta página')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Boletín' })).not.toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('con una activa, la del sistema deja de estar en uso', async () => {
    mockSignedIn(superAdminSession());
    mockTemplates([template({ isActive: true })]);
    renderApp(path);

    const list = await screen.findByRole('list', { name: 'Plantillas' });
    const row = rows(list);
    expect(within(row(0)).queryByText('En uso')).not.toBeInTheDocument();
    expect(within(row(1)).getByText('En uso')).toBeInTheDocument();
  });

  it('sube una plantilla .html con nombre y descripción', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockTemplates([]);
    const user = userEvent.setup({ applyAccept: false });
    renderApp(path);

    await user.click(await screen.findByRole('button', { name: 'Subir plantilla' }));
    const dialog = await screen.findByRole('dialog', { name: 'Subir plantilla' });
    await user.click(within(dialog).getByRole('button', { name: 'Subir plantilla' }));
    expect(
      await within(dialog).findByText('Elige el archivo .html de la plantilla.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Escribe el nombre de la plantilla.')).toBeInTheDocument();

    await user.upload(fileInput(), new File(['<p>{{student.firstName}}</p>'], 'nueva.html'));
    expect(within(dialog).getByText('nueva.html')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Nombre'), 'Boletín nuevo');
    await user.type(within(dialog).getByLabelText('Descripción (opcional)'), 'Más sobrio');
    await user.click(within(dialog).getByRole('button', { name: 'Subir plantilla' }));

    expect(await screen.findByText(/«Boletín nuevo» subida/)).toBeInTheDocument();
    expect(calls.uploads).toEqual([
      {
        name: 'Boletín nuevo',
        description: 'Más sobrio',
        file: '<p>{{student.firstName}}</p>',
      },
    ]);
    const list = await screen.findByRole('list', { name: 'Plantillas' });
    expect(await within(list).findByText('Boletín nuevo')).toBeInTheDocument();
  });

  it('rechaza sin llamar a la API un archivo que no es .html o pesa más de 256 KB', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockTemplates([]);
    const user = userEvent.setup({ applyAccept: false });
    renderApp(path);

    await user.click(await screen.findByRole('button', { name: 'Subir plantilla' }));
    const dialog = await screen.findByRole('dialog', { name: 'Subir plantilla' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Mala');

    await user.upload(fileInput(), new File(['%PDF'], 'boletin.pdf'));
    expect(await within(dialog).findByText('Usa un archivo .html.')).toBeInTheDocument();
    await user.upload(fileInput(), new File(['x'.repeat(256 * 1024 + 1)], 'grande.html'));
    expect(await within(dialog).findByText('La plantilla pesa más de 256 KB.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Subir plantilla' }));
    // Sin archivo válido no se envía; queda a la vista el motivo.
    expect(within(dialog).getByText('La plantilla pesa más de 256 KB.')).toBeInTheDocument();
    expect(calls.uploads).toHaveLength(0);
  });

  it('muestra en el diálogo por qué el backend rechazó la plantilla', async () => {
    mockSignedIn(superAdminSession());
    mockTemplates([]);
    server.use(
      http.post(apiUrl('/api/institutions/:id/report-card-templates'), () =>
        apiError(400, 'Plantilla inválida: no se permite {{{ }}}'),
      ),
    );
    const user = userEvent.setup({ applyAccept: false });
    renderApp(path);

    await user.click(await screen.findByRole('button', { name: 'Subir plantilla' }));
    const dialog = await screen.findByRole('dialog', { name: 'Subir plantilla' });
    await user.upload(fileInput(), new File(['{{{student.firstName}}}'], 'mala.html'));
    await user.type(within(dialog).getByLabelText('Nombre'), 'Mala');
    await user.click(within(dialog).getByRole('button', { name: 'Subir plantilla' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Plantilla inválida: no se permite {{{ }}}',
    );
  });

  it('usa una plantilla en los boletines y después vuelve a la del sistema', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockTemplates();
    const user = userEvent.setup();
    renderApp(path);

    await user.click(
      await screen.findByRole('button', { name: 'Acciones de la plantilla Boletín 2026' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Usar en los boletines' }));
    expect(
      await screen.findByText('Los boletines nuevos usarán «Boletín 2026».'),
    ).toBeInTheDocument();
    expect(calls.activated).toEqual([T1]);
    const list = screen.getByRole('list', { name: 'Plantillas' });
    await waitFor(() => {
      expect(within(rows(list)(1)).getByText('En uso')).toBeVisible();
    });

    await user.click(screen.getByRole('button', { name: 'Acciones de la plantilla Boletín 2026' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dejar de usar' }));
    expect(
      await screen.findByText('Los boletines nuevos usarán la plantilla del sistema.'),
    ).toBeInTheDocument();
    expect(calls.deactivated).toEqual([T1]);
  });

  it('borra una plantilla tras confirmar', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockTemplates([template(), template({ id: T2, name: 'Otra' })]);
    const user = userEvent.setup();
    renderApp(path);

    await user.click(await screen.findByRole('button', { name: 'Acciones de la plantilla Otra' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Borrar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Borrar «Otra»?' });
    await user.click(within(confirm).getByRole('button', { name: 'Borrar plantilla' }));

    expect(await screen.findByText('«Otra» borrada.')).toBeInTheDocument();
    expect(calls.deleted).toEqual([T2]);
    const list = screen.getByRole('list', { name: 'Plantillas' });
    await waitFor(() => {
      expect(within(list).queryByText('Otra')).not.toBeInTheDocument();
    });
  });

  it('si ya se usó en boletines (409), avisa que no se puede borrar', async () => {
    mockSignedIn(superAdminSession());
    mockTemplates();
    server.use(
      http.delete(apiUrl('/api/institutions/:id/report-card-templates/:tid'), () =>
        apiError(409, 'La plantilla ya se usó en boletines'),
      ),
    );
    const user = userEvent.setup();
    renderApp(path);

    await user.click(
      await screen.findByRole('button', { name: 'Acciones de la plantilla Boletín 2026' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Borrar' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Borrar plantilla' }));

    expect(
      await screen.findByText(
        'Ya se usó en boletines y no se puede borrar. Puedes dejar de usarla.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('la vista previa pide el PDF al backend y lo abre en memoria', async () => {
    mockSignedIn(superAdminSession());
    const calls = mockTemplates();
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return BLOB_URL;
      }),
      revokeObjectURL: vi.fn(),
    });
    const tab = { opener: {} as unknown, closed: false, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const user = userEvent.setup();
    renderApp(path);

    await user.click(
      await screen.findByRole('button', { name: 'Vista previa de Plantilla del sistema' }),
    );
    await waitFor(() => {
      expect(tab.location.href).toBe(BLOB_URL);
    });
    expect(tab.opener).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Vista previa de Boletín 2026' }));
    await waitFor(() => {
      expect(calls.previews).toEqual(['system', T1]);
    });
    expect(blobs[0]?.type).toBe('application/pdf');
  });
});
