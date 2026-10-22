import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Student, Teacher } from '@/api/types';
import { apiError, apiUrl, FULL, mockSignedIn, page, peopleMenu } from '@/test/api';
import { campus, student, teacher } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const PASSWORD = 'Docente-4Rt!p8';
const NEW_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const NORTE = '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
const SUR = '4a3b2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d';

function mockCampuses() {
  server.use(
    http.get(apiUrl('/api/campuses'), () =>
      HttpResponse.json(
        page([campus({ id: NORTE, name: 'Sede Norte' }), campus({ id: SUR, name: 'Sede Sur' })]),
      ),
    ),
  );
}

/** Docentes falsos de la institución activa. */
function mockTeachers(target: Teacher = teacher()) {
  const calls = { created: [] as unknown[], updated: [] as unknown[], lists: [] as string[] };
  let current = target;
  mockCampuses();
  server.use(
    http.get(apiUrl('/api/teachers'), ({ request }) => {
      calls.lists.push(new URL(request.url).search);
      return HttpResponse.json(page([current]));
    }),
    http.get(apiUrl('/api/teachers/:id'), ({ params }) =>
      params.id === current.id
        ? HttpResponse.json(current)
        : apiError(404, 'Docente no encontrado'),
    ),
    http.post(apiUrl('/api/teachers'), async ({ request }) => {
      const body = (await request.json()) as Record<string, string | null>;
      calls.created.push(body);
      current = teacher({
        id: NEW_ID,
        specialty: body.specialty ?? null,
        user: {
          ...teacher().user,
          firstName: String(body.firstName),
          lastName: String(body.lastName),
          email: body.email ?? null,
          mustChangePassword: true,
        },
      });
      return HttpResponse.json({ ...current, temporaryPassword: PASSWORD }, { status: 201 });
    }),
    http.patch(apiUrl('/api/teachers/:id'), async ({ request }) => {
      const body = (await request.json()) as Partial<Teacher>;
      calls.updated.push(body);
      current = { ...current, ...body };
      return HttpResponse.json(current);
    }),
  );
  return calls;
}

/** Estudiantes falsos de la institución activa. */
function mockStudents(target: Student = student()) {
  const calls = { created: [] as unknown[], updated: [] as unknown[] };
  let current = target;
  mockCampuses();
  server.use(
    http.get(apiUrl('/api/students'), () => HttpResponse.json(page([current]))),
    http.get(apiUrl('/api/students/:id'), ({ params }) =>
      params.id === current.id
        ? HttpResponse.json(current)
        : apiError(404, 'Estudiante no encontrado'),
    ),
    http.post(apiUrl('/api/students'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.created.push(body);
      return HttpResponse.json(
        { ...student({ id: NEW_ID }), temporaryPassword: PASSWORD },
        { status: 201 },
      );
    }),
    http.patch(apiUrl('/api/students/:id'), async ({ request }) => {
      const body = (await request.json()) as { campusId?: string };
      calls.updated.push(body);
      if (body.campusId === SUR) {
        current = { ...current, campus: { id: SUR, name: 'Sede Sur', isActive: true } };
      }
      return HttpResponse.json(current);
    }),
  );
  return calls;
}

describe('docentes', () => {
  it('crea un docente, muestra la contraseña una sola vez y abre su ficha', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockTeachers();
    const user = userEvent.setup();
    const { router, queryClient } = renderApp('/people/teachers');

    expect((await screen.findAllByText('Laura Gómez')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Nuevo docente' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo docente' });
    await user.type(within(dialog).getByLabelText('Número de documento'), '79111222');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Pedro');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Vargas');
    await user.type(within(dialog).getByLabelText('Especialidad (opcional)'), 'Física');
    await user.selectOptions(within(dialog).getByLabelText('Sede'), NORTE);
    await user.click(within(dialog).getByRole('button', { name: 'Crear docente' }));

    const done = await screen.findByRole('dialog', { name: 'Docente creado' });
    expect(within(done).getByLabelText('Contraseña temporal')).toHaveTextContent(PASSWORD);
    expect(calls.created).toEqual([
      {
        documentType: 'CC',
        documentNumber: '79111222',
        firstName: 'Pedro',
        lastName: 'Vargas',
        email: null,
        phone: null,
        academicDegree: null,
        specialty: 'Física',
        campusId: NORTE,
      },
    ]);

    await user.click(within(done).getByRole('button', { name: 'Listo' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/people/teachers/${NEW_ID}`);
    });
    expect(await screen.findByRole('heading', { name: 'Pedro Vargas' })).toBeInTheDocument();
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

  it('el filtro de sede va en la URL y llega a la API', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockTeachers();
    const user = userEvent.setup();
    const { router } = renderApp('/people/teachers');

    await user.selectOptions(await screen.findByLabelText('Sede'), SUR);
    await waitFor(() => {
      expect(router.state.location.search).toBe(`?campus=${SUR}`);
    });
    await waitFor(() => {
      expect(calls.lists.at(-1)).toContain(`campusId=${SUR}`);
    });
  });

  it('en la ficha guarda solo lo que cambió; sin permiso de Usuarios no ofrece la cuenta', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockTeachers();
    const user = userEvent.setup();
    renderApp(`/people/teachers/${teacher().id}`);

    const degree = await screen.findByLabelText('Título académico (opcional)');
    await user.clear(degree);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Datos guardados.')).toBeInTheDocument();
    expect(calls.updated).toEqual([{ academicDegree: null }]);
    expect(screen.queryByRole('button', { name: 'Desactivar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nueva contraseña temporal' })).toBeNull();
  });

  it('con permiso de Usuarios, desactiva la cuenta del docente y recarga su ficha', async () => {
    mockSignedIn(makeSession(), peopleMenu(FULL, { users: FULL }));
    mockTeachers();
    const status: unknown[] = [];
    server.use(
      http.patch(apiUrl('/api/users/:id/status'), async ({ params, request }) => {
        status.push({ id: params.id, ...((await request.json()) as object) });
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderApp(`/people/teachers/${teacher().id}`);

    await user.click(await screen.findByRole('button', { name: 'Desactivar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Desactivar a Laura Gómez?' });
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar usuario' }));
    expect(await screen.findByText('Laura Gómez quedó inactivo.')).toBeInTheDocument();
    expect(status).toEqual([{ id: teacher().user.id, isActive: false }]);
  });

  it('un docente que no existe responde «no encontrada»', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    mockTeachers();
    renderApp(`/people/teachers/${NEW_ID}`);
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
  });
});

describe('estudiantes', () => {
  it('con el permiso limitado a una sede, exige la sede al crear', async () => {
    mockSignedIn(makeSession(), peopleMenu(FULL, { siteOnly: true }));
    const calls = mockStudents();
    const user = userEvent.setup();
    renderApp('/people/students');

    await user.click(await screen.findByRole('button', { name: 'Nuevo estudiante' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo estudiante' });
    expect(within(dialog).getByLabelText('Tipo de documento')).toHaveValue('TI');
    expect(within(dialog).queryByRole('option', { name: 'Sin sede' })).toBeNull();
    await user.type(within(dialog).getByLabelText('Número de documento'), '1098765432');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Sara');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Pinto');
    await user.click(within(dialog).getByRole('button', { name: 'Crear estudiante' }));
    expect(
      await within(dialog).findByText('Elige la sede: solo puedes crear en tus sedes.'),
    ).toBeInTheDocument();
    expect(calls.created).toHaveLength(0);

    await user.selectOptions(within(dialog).getByLabelText('Sede'), NORTE);
    await user.selectOptions(within(dialog).getByLabelText('Tipo de sangre (opcional)'), 'A+');
    await user.click(within(dialog).getByRole('button', { name: 'Crear estudiante' }));
    expect(await screen.findByRole('dialog', { name: 'Estudiante creado' })).toHaveTextContent(
      PASSWORD,
    );
    expect(calls.created).toEqual([
      expect.objectContaining({ campusId: NORTE, bloodType: 'A+', studentCode: null }),
    ]);
  });

  it('cambiar de sede pide confirmación y envía solo la sede', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockStudents();
    const user = userEvent.setup();
    renderApp(`/people/students/${student().id}`);

    await user.selectOptions(await screen.findByLabelText('Sede'), SUR);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: '¿Cambiar a Mateo de sede?',
    });
    expect(within(confirm).getByText(/Pasa a «Sede Sur»/)).toBeInTheDocument();
    expect(calls.updated).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Cambiar de sede' }));
    await waitFor(() => {
      expect(calls.updated).toEqual([{ campusId: SUR }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  it('si tras cambiarlo de sede ya no puede verlo (404), quita su ficha y vuelve al listado', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    mockStudents();
    server.use(
      http.patch(apiUrl('/api/students/:id'), () => apiError(404, 'Estudiante no encontrado')),
    );
    const user = userEvent.setup();
    const { router, queryClient } = renderApp(`/people/students/${student().id}`);

    await user.selectOptions(await screen.findByLabelText('Sede'), SUR);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Cambiar de sede' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/people/students');
    });
    expect(await screen.findByText(/Ya no puedes ver a este estudiante/)).toBeInTheDocument();
    const details = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => q.queryKey.includes('detail'));
    expect(details).toEqual([]);
  });

  it('sin el permiso de Sedes no elige sede, lo dice y crea en toda la institución', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockStudents();
    server.use(http.get(apiUrl('/api/campuses'), () => apiError(403, 'Sin permiso')));
    const user = userEvent.setup();
    renderApp('/people/students');

    await user.click(await screen.findByRole('button', { name: 'Nuevo estudiante' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo estudiante' });
    expect(within(dialog).getByLabelText('Sede')).toBeDisabled();
    expect(within(dialog).getByText(/Sin el permiso de Sedes/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/No pudimos cargar las sedes/)).toBeNull();
    await user.type(within(dialog).getByLabelText('Número de documento'), '1098765432');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Sara');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Pinto');
    await user.click(within(dialog).getByRole('button', { name: 'Crear estudiante' }));
    expect(await screen.findByRole('dialog', { name: 'Estudiante creado' })).toBeInTheDocument();
    expect(calls.created).toEqual([expect.objectContaining({ campusId: null })]);
  });

  it('quien solo puede verlo no recibe ni ve documento, contacto ni acudiente', async () => {
    mockSignedIn(
      makeSession(),
      peopleMenu({ view: true, create: false, update: false, delete: false }),
    );
    mockStudents(
      student({
        user: {
          id: student().user.id,
          firstName: 'Mateo',
          lastName: 'Rojas',
          isActive: true,
          hasAvatar: false,
        },
        guardianName: undefined,
        guardianPhone: undefined,
        guardianEmail: undefined,
        bloodType: undefined,
      }),
    );
    renderApp(`/people/students/${student().id}`);

    expect(await screen.findByText(/Solo ves sus datos básicos/)).toBeInTheDocument();
    expect(screen.getByText('Sede Norte')).toBeInTheDocument();
    expect(screen.queryByLabelText('Número de documento')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
  });
});
