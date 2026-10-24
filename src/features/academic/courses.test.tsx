import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AcademicYear, Course, Enrollment, TeacherAssignment } from '@/api/types';
import {
  academicMenu,
  apiError,
  apiUrl,
  FULL,
  menuNode,
  mockSignedIn,
  NO_ACCESS,
  page,
  peopleMenu,
  VIEW_ONLY,
} from '@/test/api';
import { campus, student, teacher } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const STAMP = '2026-01-10T15:00:00.000Z';
const Y2026 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const Y2025 = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const NORTE = '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
const SUR = '4a3b2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d';
const SEXTO = '3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d6e';
const SEPTIMO = '4c5d6e7f-8a9b-4c0d-9e1f-2a3b4c5d6e7f';
const MATE = '5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a';
const C601 = '6e7f8a9b-0c1d-4e2f-9a3b-4c5d6e7f8a9b';
const C602 = '7f8a9b0c-1d2e-4f3a-8b4c-5d6e7f8a9b0c';
const NEW_TEACHER = '8a9b0c1d-2e3f-4a4b-9c5d-6e7f8a9b0c1d';
const ENROLLMENT = '9b0c1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e';

const year = (id: string, value: number, isActive = true): AcademicYear => ({
  id,
  institutionId: 'inst-1',
  year: value,
  isActive,
  createdAt: STAMP,
});

const course = (id: string, name: string, overrides: Partial<Course> = {}): Course => ({
  id,
  name,
  grade: { id: SEXTO, name: 'Sexto' },
  campus: { id: NORTE, name: 'Sede Norte', isActive: true },
  academicYear: { id: Y2026, year: 2026, isActive: true },
  createdAt: STAMP,
  ...overrides,
});

const assignment = (overrides: Partial<TeacherAssignment> = {}): TeacherAssignment => ({
  id: 'a-1',
  isActive: true,
  course: course(C601, '601'),
  subject: { id: MATE, name: 'Matemáticas' },
  teacher: { id: teacher().id, userId: teacher().user.id, firstName: 'Laura', lastName: 'Gómez' },
  createdAt: STAMP,
  deactivatedAt: null,
  ...overrides,
});

const enrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: ENROLLMENT,
  status: 'ENROLLED',
  enrollmentDate: STAMP,
  student: { id: student().id, studentCode: '2026-0153', firstName: 'Mateo', lastName: 'Rojas' },
  course: {
    id: C601,
    name: '601',
    grade: { id: SEXTO, name: 'Sexto' },
    campus: { id: NORTE, name: 'Sede Norte', isActive: true },
  },
  academicYear: { id: Y2026, year: 2026, isActive: true },
  ...overrides,
});

/** API académica falsa: guarda las consultas y lo que llega en cada escritura. */
function mockAcademic() {
  const courses = [
    course(C601, '601'),
    course(C602, '602', { campus: { id: SUR, name: 'Sede Sur', isActive: true } }),
  ];
  const assignments = [assignment()];
  const enrollments = [enrollment()];
  const calls = {
    courseQueries: [] as URLSearchParams[],
    assignmentQueries: [] as URLSearchParams[],
    enrollmentQueries: [] as URLSearchParams[],
    studentQueries: [] as URLSearchParams[],
    coursesSaved: [] as unknown[],
    assigned: [] as unknown[],
    replaced: [] as unknown[],
    deactivated: [] as string[],
    enrolled: [] as unknown[],
    enrollmentsPatched: [] as unknown[],
    deletedCourses: [] as string[],
  };
  server.use(
    http.get(apiUrl('/api/academic-years'), () =>
      HttpResponse.json(page([year(Y2026, 2026), year(Y2025, 2025, false)])),
    ),
    http.get(apiUrl('/api/grades'), () =>
      HttpResponse.json(
        page([
          { id: SEXTO, institutionId: 'inst-1', name: 'Sexto', createdAt: STAMP },
          { id: SEPTIMO, institutionId: 'inst-1', name: 'Séptimo', createdAt: STAMP },
        ]),
      ),
    ),
    http.get(apiUrl('/api/subjects'), () =>
      HttpResponse.json(
        page([{ id: MATE, institutionId: 'inst-1', name: 'Matemáticas', createdAt: STAMP }]),
      ),
    ),
    http.get(apiUrl('/api/campuses'), () =>
      HttpResponse.json(
        page([campus({ id: NORTE, name: 'Sede Norte' }), campus({ id: SUR, name: 'Sede Sur' })]),
      ),
    ),
    http.get(apiUrl('/api/courses'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.courseQueries.push(params);
      const yearId = params.get('academicYearId');
      return HttpResponse.json(
        page(courses.filter((c) => !yearId || c.academicYear.id === yearId)),
      );
    }),
    http.get(apiUrl('/api/courses/:id'), ({ params }) => {
      const found = courses.find((c) => c.id === params.id);
      return found ? HttpResponse.json(found) : apiError(404, 'Curso no encontrado');
    }),
    http.post(apiUrl('/api/courses'), async ({ request }) => {
      const body = (await request.json()) as Record<string, string>;
      calls.coursesSaved.push(body);
      const created = course('0c1d2e3f-4a5b-4c6d-9e7f-8a9b0c1d2e3f', String(body.name));
      courses.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl('/api/courses/:id'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, string>;
      calls.coursesSaved.push({ id: params.id, ...body });
      if (body.gradeId)
        return apiError(
          409,
          'El curso ya tiene carga académica o matrículas: no se puede cambiar su grado, sede ni año',
        );
      const found = courses.find((c) => c.id === params.id);
      if (!found) return apiError(404, 'Curso no encontrado');
      if (body.name) found.name = body.name;
      return HttpResponse.json(found);
    }),
    http.delete(apiUrl('/api/courses/:id'), ({ params }) => {
      calls.deletedCourses.push(String(params.id));
      courses.splice(
        courses.findIndex((c) => c.id === params.id),
        1,
      );
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(apiUrl('/api/teacher-assignments'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.assignmentQueries.push(params);
      const active = params.get('isActive');
      return HttpResponse.json(
        page(assignments.filter((a) => active === null || String(a.isActive) === active)),
      );
    }),
    http.post(apiUrl('/api/teacher-assignments'), async ({ request }) => {
      const body = await request.json();
      calls.assigned.push(body);
      return apiError(400, 'El docente no tiene el rol TEACHER en la sede del curso');
    }),
    http.post(apiUrl('/api/teacher-assignments/:id/replace'), async ({ params, request }) => {
      const body = await request.json();
      calls.replaced.push({ id: params.id, ...(body as object) });
      return HttpResponse.json(assignment({ id: 'a-2' }), { status: 201 });
    }),
    http.patch(apiUrl('/api/teacher-assignments/:id/deactivate'), ({ params }) => {
      calls.deactivated.push(String(params.id));
      const found = assignments.find((a) => a.id === params.id);
      if (found) {
        found.isActive = false;
        found.deactivatedAt = STAMP;
      }
      return HttpResponse.json(found);
    }),
    http.get(apiUrl('/api/enrollments'), ({ request }) => {
      calls.enrollmentQueries.push(new URL(request.url).searchParams);
      return HttpResponse.json(page(enrollments));
    }),
    http.get(apiUrl('/api/enrollments/:id'), () =>
      HttpResponse.json({ ...enrollments[0], observations: 'Llegó de otro colegio.' }),
    ),
    http.post(apiUrl('/api/enrollments'), async ({ request }) => {
      const body = await request.json();
      calls.enrolled.push(body);
      return HttpResponse.json(enrollment(), { status: 201 });
    }),
    http.patch(apiUrl('/api/enrollments/:id'), async ({ request }) => {
      const body = (await request.json()) as Partial<Enrollment>;
      calls.enrollmentsPatched.push(body);
      Object.assign(enrollments[0] ?? {}, body);
      return HttpResponse.json(enrollments[0]);
    }),
    http.get(apiUrl('/api/teachers'), () =>
      HttpResponse.json(
        page([
          teacher(),
          teacher({
            id: NEW_TEACHER,
            user: {
              ...teacher().user,
              id: 'u-2',
              firstName: 'Pedro',
              lastName: 'Vargas',
              documentNumber: '79111222',
            },
          }),
        ]),
      ),
    ),
    http.get(apiUrl('/api/students'), ({ request }) => {
      calls.studentQueries.push(new URL(request.url).searchParams);
      return HttpResponse.json(page([student()]));
    }),
    http.get(apiUrl('/api/students/invitations'), () => HttpResponse.json([])),
    http.get(apiUrl('/api/students/:id'), () => HttpResponse.json(student())),
  );
  return calls;
}

/** Académico y Personas completos. */
const fullMenu = () => [...academicMenu(), ...peopleMenu()];

describe('cursos', () => {
  it('lista los cursos del año activo y filtra por grado y sede en la URL', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    const { router } = renderApp('/academic/courses');

    const table = await screen.findByRole('table', { name: 'Cursos' });
    expect(within(table).getByRole('link', { name: '601' })).toHaveAttribute(
      'href',
      `/academic/courses/${C601}`,
    );
    // Sin año en la URL: el activo más reciente, nunca todos los años.
    expect(calls.courseQueries.every((q) => q.get('academicYearId') === Y2026)).toBe(true);

    await user.selectOptions(await screen.findByLabelText('Grado'), SEPTIMO);
    await user.selectOptions(screen.getByLabelText('Sede'), SUR);
    expect(router.state.location.search).toBe(`?grade=${SEPTIMO}&campus=${SUR}`);
    await waitFor(() => {
      expect(calls.courseQueries.at(-1)?.get('gradeId')).toBe(SEPTIMO);
    });
    expect(calls.courseQueries.at(-1)?.get('campusId')).toBe(SUR);

    await user.selectOptions(screen.getByLabelText('Año lectivo'), 'all');
    await waitFor(() => {
      expect(calls.courseQueries.at(-1)?.has('academicYearId')).toBe(false);
    });
  });

  it('crea un curso con el año activo preseleccionado y al editar envía solo lo que cambió', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    renderApp('/academic/courses');

    await user.click(await screen.findByRole('button', { name: 'Nuevo curso' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo curso' });
    const yearSelect = await within(dialog).findByLabelText('Año lectivo');
    expect(yearSelect).toHaveValue(Y2026);
    // Solo años activos.
    expect(within(yearSelect).queryByRole('option', { name: /2025/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Crear curso' }));
    expect(await within(dialog).findByText('Escribe el nombre del curso.')).toBeInTheDocument();
    expect(within(dialog).getByText('Elige el grado.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Nombre'), '603');
    await user.selectOptions(within(dialog).getByLabelText('Grado'), SEXTO);
    await user.selectOptions(within(dialog).getByLabelText('Sede'), NORTE);
    await user.click(within(dialog).getByRole('button', { name: 'Crear curso' }));
    expect(await screen.findByText('Curso 603 creado.')).toBeInTheDocument();
    expect(calls.coursesSaved).toEqual([
      { name: '603', gradeId: SEXTO, campusId: NORTE, academicYearId: Y2026 },
    ]);

    const table = screen.getByRole('table', { name: 'Cursos' });
    await user.click(within(table).getByRole('button', { name: 'Acciones de 601' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const edit = await screen.findByRole('dialog', { name: 'Editar el curso 601' });
    await user.selectOptions(await within(edit).findByLabelText('Grado'), SEPTIMO);
    await user.click(within(edit).getByRole('button', { name: 'Guardar cambios' }));
    expect(
      await within(edit).findByText(
        'El curso ya tiene carga académica o matrículas: no se puede cambiar su grado, sede ni año',
      ),
    ).toBeInTheDocument();
    expect(calls.coursesSaved.at(-1)).toEqual({ id: C601, gradeId: SEPTIMO });
  });

  it('la ficha muestra la carga y los estudiantes en pestañas, y eliminar vuelve al listado', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    const { router } = renderApp(`/academic/courses/${C602}`);

    expect(await screen.findByRole('heading', { name: 'Curso 602' })).toBeInTheDocument();
    expect(screen.getByText(/Sexto · Sede Sur · Año lectivo 2026/)).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Carga académica' });
    expect(calls.assignmentQueries.at(-1)?.get('courseId')).toBe(C602);

    await user.click(screen.getByRole('tab', { name: 'Estudiantes' }));
    expect(router.state.location.search).toBe('?tab=students');
    await screen.findByRole('table', { name: 'Matrículas' });
    expect(calls.enrollmentQueries.at(-1)?.get('courseId')).toBe(C602);

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Eliminar el curso 602?' });
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar curso' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/academic/courses');
    });
    expect(calls.deletedCourses).toEqual([C602]);
    expect(screen.queryByText(/no encontrad/i)).not.toBeInTheDocument();
  });

  it('sin permisos de carga ni matrículas, la ficha no muestra pestañas; con solo ver, no hay acciones', async () => {
    mockSignedIn(makeSession(), [
      menuNode('academic', 'Académico', VIEW_ONLY, [
        menuNode('academic.courses', 'Cursos', VIEW_ONLY),
        menuNode('academic.teacher-assignments', 'Carga académica', NO_ACCESS),
        menuNode('academic.enrollments', 'Matrículas', NO_ACCESS),
      ]),
    ]);
    mockAcademic();
    renderApp(`/academic/courses/${C601}`);

    expect(await screen.findByRole('heading', { name: 'Curso 601' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });
});

describe('carga académica', () => {
  it('asigna buscando al docente y muestra el motivo del backend', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    renderApp(`/academic/courses/${C601}`);

    await user.click(await screen.findByRole('button', { name: 'Asignar materia' }));
    const dialog = await screen.findByRole('dialog', { name: 'Asignar materia' });
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialog).findByText('Elige la materia.')).toBeInTheDocument();
    expect(within(dialog).getByText('Elige el docente.')).toBeInTheDocument();

    await user.selectOptions(await within(dialog).findByLabelText('Materia'), MATE);
    const teacherSelect = within(dialog).getByLabelText('Docente');
    await waitFor(() => {
      expect(
        within(teacherSelect).getByRole('option', { name: /Pedro Vargas/ }),
      ).toBeInTheDocument();
    });
    await user.selectOptions(teacherSelect, NEW_TEACHER);
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(
      await within(dialog).findByText('El docente no tiene el rol TEACHER en la sede del curso'),
    ).toBeInTheDocument();
    expect(calls.assigned).toEqual([{ courseId: C601, subjectId: MATE, teacherId: NEW_TEACHER }]);
  });

  it('cambia el docente (sin ofrecer el actual) y termina una asignación', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    renderApp('/academic/teacher-assignments');

    const table = await screen.findByRole('table', { name: 'Carga académica' });
    expect(within(table).getByRole('link', { name: '601 · Sexto' })).toBeInTheDocument();
    const actions = 'Acciones de Matemáticas con Laura Gómez';
    await user.click(within(table).getByRole('button', { name: actions }));
    await user.click(screen.getByRole('menuitem', { name: 'Cambiar docente' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar docente' });
    const select = within(dialog).getByLabelText('Docente');
    await waitFor(() => {
      expect(within(select).getByRole('option', { name: /Pedro Vargas/ })).toBeInTheDocument();
    });
    expect(within(select).queryByRole('option', { name: /Laura Gómez/ })).not.toBeInTheDocument();
    await user.selectOptions(select, NEW_TEACHER);
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar docente' }));
    expect(await screen.findByText('Docente cambiado.')).toBeInTheDocument();
    expect(calls.replaced).toEqual([{ id: 'a-1', teacherId: NEW_TEACHER }]);

    await user.click(within(table).getByRole('button', { name: actions }));
    await user.click(screen.getByRole('menuitem', { name: 'Terminar' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Terminar asignación' }));
    expect(await screen.findByText('Asignación terminada.')).toBeInTheDocument();
    expect(calls.deactivated).toEqual(['a-1']);
  });

  it('sin permiso de ver docentes, el selector lo explica y no los pide', async () => {
    mockSignedIn(makeSession(), academicMenu());
    mockAcademic();
    const teacherRequests: string[] = [];
    server.use(
      http.get(apiUrl('/api/teachers'), ({ request }) => {
        teacherRequests.push(request.url);
        return apiError(403, 'Sin permiso');
      }),
    );
    const user = userEvent.setup();
    renderApp(`/academic/courses/${C601}`);

    await user.click(await screen.findByRole('button', { name: 'Asignar materia' }));
    const dialog = await screen.findByRole('dialog', { name: 'Asignar materia' });
    expect(
      within(dialog).getByText(
        'Para elegir un docente necesitas también el permiso de ver Docentes.',
      ),
    ).toBeInTheDocument();
    expect(teacherRequests).toEqual([]);
  });
});

describe('matrículas', () => {
  it('matricula desde la ficha del curso', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    renderApp(`/academic/courses/${C601}?tab=students`);

    await user.click(await screen.findByRole('button', { name: 'Matricular' }));
    const dialog = await screen.findByRole('dialog', { name: 'Matricular' });
    const select = within(dialog).getByLabelText('Estudiante');
    await waitFor(() => {
      expect(within(select).getByRole('option', { name: /Mateo Rojas/ })).toBeInTheDocument();
    });
    await user.selectOptions(select, student().id);
    await user.type(within(dialog).getByLabelText('Observaciones (opcional)'), '  Viene de Cali ');
    await user.click(within(dialog).getByRole('button', { name: 'Matricular' }));
    expect(await screen.findByText('Estudiante matriculado.')).toBeInTheDocument();
    expect(calls.enrolled).toEqual([
      { studentId: student().id, courseId: C601, observations: 'Viene de Cali' },
    ]);
  });

  it('edita el estado con los cambios permitidos y envía solo lo que cambió', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    const { router } = renderApp('/academic/enrollments');

    const table = await screen.findByRole('table', { name: 'Matrículas' });
    await user.click(
      within(table).getByRole('button', { name: 'Acciones de la matrícula de Mateo Rojas' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Editar matrícula' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar matrícula' });
    expect(await within(dialog).findByLabelText('Observaciones (opcional)')).toHaveValue(
      'Llegó de otro colegio.',
    );
    const status = within(dialog).getByLabelText('Estado');
    expect(
      within(status)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Matriculado', 'Suspendido', 'Retirado', 'Graduado']);
    await user.selectOptions(status, 'DROPPED');
    // Retirado: el curso ya no cambia.
    expect(within(dialog).getByLabelText('Curso')).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Matrícula guardada.')).toBeInTheDocument();
    expect(calls.enrollmentsPatched).toEqual([{ status: 'DROPPED' }]);

    // Retirado solo puede volver a Matriculado.
    await user.click(
      within(table).getByRole('button', { name: 'Acciones de la matrícula de Mateo Rojas' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Editar matrícula' }));
    const again = await screen.findByRole('dialog', { name: 'Editar matrícula' });
    const status2 = await within(again).findByLabelText('Estado');
    expect(
      within(status2)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Retirado', 'Matriculado']);
    await user.keyboard('{Escape}');

    await user.selectOptions(screen.getByLabelText('Estado'), 'SUSPENDED');
    expect(router.state.location.search).toContain('state=SUSPENDED');
    await waitFor(() => {
      expect(calls.enrollmentQueries.at(-1)?.get('status')).toBe('SUSPENDED');
    });
  });

  it('un estado inválido en la URL no llega a la API', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    renderApp('/academic/enrollments?state=HACKED');
    await screen.findByRole('table', { name: 'Matrículas' });
    expect(calls.enrollmentQueries.every((q) => !q.has('status'))).toBe(true);
  });
});

describe('estudiantes y matrículas', () => {
  it('la lista de estudiantes se filtra por curso del año activo', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const user = userEvent.setup();
    const { router } = renderApp('/people/students');

    await user.selectOptions(await screen.findByLabelText('Curso (2026)'), C601);
    expect(router.state.location.search).toBe(`?course=${C601}`);
    await waitFor(() => {
      expect(calls.studentQueries.at(-1)?.get('courseId')).toBe(C601);
    });
  });

  it('sin permiso de Años lectivos (docente), ofrece los cursos de todos los años', async () => {
    mockSignedIn(makeSession(), [
      menuNode('academic', 'Académico', VIEW_ONLY, [
        menuNode('academic.courses', 'Cursos', VIEW_ONLY),
      ]),
      menuNode('people', 'Personas', VIEW_ONLY, [
        menuNode('people.students', 'Estudiantes', VIEW_ONLY),
      ]),
    ]);
    const calls = mockAcademic();
    renderApp('/people/students');

    const select = await screen.findByLabelText('Curso');
    expect(
      within(select).getByRole('option', { name: /601 · Sexto · Sede Norte \(2026\)/ }),
    ).toBeInTheDocument();
    expect(calls.courseQueries.every((q) => !q.has('academicYearId'))).toBe(true);
  });

  it('la ficha del estudiante muestra sus matrículas solo con el permiso de Matrículas', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    renderApp(`/people/students/${student().id}`);

    const section = await screen.findByRole('region', { name: 'Matrículas' });
    expect(await within(section).findByRole('link', { name: 'Curso 601' })).toHaveAttribute(
      'href',
      `/academic/courses/${C601}`,
    );
    expect(within(section).getByText('Matriculado')).toBeInTheDocument();
    expect(calls.enrollmentQueries.at(-1)?.get('studentId')).toBe(student().id);
  });

  it('sin permiso de Matrículas, la ficha no las pide', async () => {
    mockSignedIn(makeSession(), [
      ...peopleMenu(),
      menuNode('academic', 'Académico', FULL, [
        menuNode('academic.enrollments', 'Matrículas', NO_ACCESS),
      ]),
    ]);
    const calls = mockAcademic();
    renderApp(`/people/students/${student().id}`);

    await screen.findByRole('heading', { name: 'Mateo Rojas' });
    expect(screen.queryByRole('region', { name: 'Matrículas' })).not.toBeInTheDocument();
    expect(calls.enrollmentQueries).toEqual([]);
  });
});

describe('correcciones de la revisión de seguridad (3d-2)', () => {
  it('B2: un id de filtro que no está entre las opciones no llega a la API', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    const unknown = '0a0b0c0d-0e0f-4a1b-8c2d-3e4f5a6b7c8d';
    renderApp(`/academic/courses?grade=${unknown}&campus=${unknown}`);

    await screen.findByRole('table', { name: 'Cursos' });
    expect(calls.courseQueries.length).toBeGreaterThan(0);
    expect(calls.courseQueries.every((q) => !q.has('gradeId') && !q.has('campusId'))).toBe(true);
    expect(screen.getByLabelText('Grado')).toHaveValue('');
    expect(screen.getByLabelText('Sede')).toHaveValue('');
  });

  it('B1: sin permiso de ver Cursos, el curso de la URL no filtra a los estudiantes', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockAcademic();
    renderApp(`/people/students?course=${C601}`);

    await screen.findByRole('table', { name: 'Estudiantes' });
    expect(calls.studentQueries.length).toBeGreaterThan(0);
    expect(calls.studentQueries.every((q) => !q.has('courseId'))).toBe(true);
    expect(calls.courseQueries).toEqual([]);
  });

  it('B3: guardar una matrícula no vuelve a pedir su detalle con las observaciones', async () => {
    mockSignedIn(makeSession(), fullMenu());
    const calls = mockAcademic();
    let detailRequests = 0;
    server.use(
      http.get(apiUrl('/api/enrollments/:id'), () => {
        detailRequests += 1;
        return HttpResponse.json({ ...enrollment(), observations: 'Llegó de otro colegio.' });
      }),
    );
    const user = userEvent.setup();
    renderApp('/academic/enrollments');

    const table = await screen.findByRole('table', { name: 'Matrículas' });
    await user.click(
      within(table).getByRole('button', { name: 'Acciones de la matrícula de Mateo Rojas' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Editar matrícula' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar matrícula' });
    await user.selectOptions(await within(dialog).findByLabelText('Estado'), 'SUSPENDED');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect((await screen.findAllByText('Matrícula guardada.')).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.enrollmentsPatched).toEqual([{ status: 'SUSPENDED' }]);
    expect(detailRequests).toBe(1);
  });

  it('I1: sin permiso de ver Sedes no las pide y el formulario lo explica', async () => {
    mockSignedIn(makeSession(), academicMenu());
    mockAcademic();
    let campusRequests = 0;
    server.use(
      http.get(apiUrl('/api/campuses'), () => {
        campusRequests += 1;
        return apiError(403, 'Sin permiso');
      }),
    );
    const user = userEvent.setup();
    renderApp('/academic/courses');

    await user.click(await screen.findByRole('button', { name: 'Nuevo curso' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo curso' });
    expect(
      await within(dialog).findByText('Para elegir la sede necesitas también el permiso de Sedes.'),
    ).toBeInTheDocument();
    expect(campusRequests).toBe(0);
  });
});
