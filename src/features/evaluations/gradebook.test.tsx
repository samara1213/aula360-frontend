import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type {
  AcademicYear,
  Course,
  CourseGradebook,
  Period,
  StudentGradebook,
  TeacherAssignment,
} from '@/api/types';
import {
  academicMenu,
  apiError,
  apiUrl,
  evaluationsMenu,
  menuNode,
  mockSignedIn,
  page,
  peopleMenu,
  VIEW_ONLY,
} from '@/test/api';
import { student as studentFixture, teacher } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const STAMP = '2026-01-10T15:00:00.000Z';
const Y2026 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const NORTE = '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
const SEXTO = '3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d6e';
const MATE = '5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a';
const FISICA = '2e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a6b';
const C601 = '6e7f8a9b-0c1d-4e2f-9a3b-4c5d6e7f8a9b';
const C602 = '7f8a9b0c-1d2e-4f3a-8b4c-5d6e7f8a9b0c';
const P1 = '9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const P2 = '0d1e2f3a-4b5c-4d6e-9f7a-8b9c0d1e2f3a';
const S1 = '3a4b5c6d-7e8f-4a9b-8c0d-1e2f3a4b5c6d';
const S2 = '4b5c6d7e-8f9a-4b0c-9d1e-2f3a4b5c6d7e';

const course = (id: string, name: string): Course => ({
  id,
  name,
  grade: { id: SEXTO, name: 'Sexto' },
  campus: { id: NORTE, name: 'Sede Norte', isActive: true },
  academicYear: { id: Y2026, year: 2026, isActive: true },
  createdAt: STAMP,
});

const assignment = (id: string, c: Course): TeacherAssignment => ({
  id,
  isActive: true,
  course: c,
  subject: { id: MATE, name: 'Matemáticas' },
  teacher: { id: teacher().id, userId: teacher().user.id, firstName: 'Laura', lastName: 'Gómez' },
  createdAt: STAMP,
  deactivatedAt: null,
});

const period = (id: string, name: string, startDate: string, endDate: string): Period => ({
  id,
  academicYearId: Y2026,
  name,
  startDate,
  endDate,
  createdAt: STAMP,
});
// Uno terminado y otro en curso, sin depender de la fecha de hoy.
const PERIODS = [
  period(P1, 'Primer periodo', '2000-01-10', '2000-04-10'),
  period(P2, 'Segundo periodo', '2000-05-01', '2999-12-31'),
];

const grade = (overrides: Partial<CourseGradebook['students'][number]['subjects'][number]>) => ({
  subjectId: MATE,
  evaluationCount: 2,
  scoredCount: 2,
  allocatedPercentage: 100,
  accumulated: 4.2,
  final: 4.2,
  passed: true,
  ...overrides,
});

const COURSE_BOOK: CourseGradebook = {
  course: { id: C601, name: '601' },
  period: { id: P2, name: 'Segundo periodo', startDate: '2000-05-01', endDate: '2999-12-31' },
  scale: { min: 1, max: 5, passingScore: 3 },
  subjects: [
    { id: MATE, name: 'Matemáticas' },
    { id: FISICA, name: 'Física' },
  ],
  students: [
    {
      student: { id: S1, firstName: 'Mateo', lastName: 'Rojas' },
      enrollmentStatus: 'ENROLLED',
      subjects: [
        grade({}),
        grade({ subjectId: FISICA, final: 2.5, accumulated: 2.5, passed: false }),
      ],
      average: 3.35,
    },
    {
      student: { id: S2, firstName: 'Sara', lastName: 'López' },
      enrollmentStatus: 'SUSPENDED',
      subjects: [
        grade({ final: null, passed: null, scoredCount: 1, accumulated: 1.8 }),
        grade({
          subjectId: FISICA,
          evaluationCount: 0,
          scoredCount: 0,
          final: null,
          passed: null,
          accumulated: 0,
          allocatedPercentage: 0,
        }),
      ],
      average: null,
    },
  ],
};

const STUDENT_BOOK: StudentGradebook = {
  student: { id: S1, firstName: 'Mateo', lastName: 'Rojas' },
  enrollmentStatus: 'ENROLLED',
  course: { id: C601, name: '601' },
  academicYear: { id: Y2026, year: 2026, isActive: true },
  scale: { min: 1, max: 5, passingScore: 3 },
  periods: PERIODS.map(({ id, name, startDate, endDate }) => ({ id, name, startDate, endDate })),
  subjects: [
    {
      id: MATE,
      name: 'Matemáticas',
      periods: [
        {
          periodId: P1,
          ...grade({ final: 4, accumulated: 4 }),
          evaluations: [
            {
              id: 'ev-1',
              title: 'Taller de fracciones',
              percentage: 60,
              evaluationDate: '2000-02-10',
              score: 4,
            },
            {
              id: 'ev-2',
              title: 'Quiz',
              percentage: 40,
              evaluationDate: '2000-03-10',
              score: 4,
            },
          ],
        },
        {
          periodId: P2,
          ...grade({ final: null, passed: null, scoredCount: 1, accumulated: 2 }),
          evaluations: [
            {
              id: 'ev-3',
              title: 'Exposición',
              percentage: 50,
              evaluationDate: '2026-05-10',
              score: 4,
            },
            {
              id: 'ev-4',
              title: 'Evaluación final',
              percentage: 50,
              evaluationDate: '2026-06-10',
              score: null,
            },
          ],
        },
      ],
      yearFinal: null,
      yearPassed: null,
    },
  ],
  periodAverages: [
    { periodId: P1, average: 4 },
    { periodId: P2, average: null },
  ],
  yearAverage: null,
};

const teacherSession = () =>
  makeSession({
    institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['TEACHER'] }],
    user: { userType: 'TEACHER', firstName: 'Laura', lastName: 'Gómez' },
  });
const studentSession = () =>
  makeSession({
    institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['STUDENT'] }],
    user: { userType: 'STUDENT', firstName: 'Mateo', lastName: 'Rojas' },
  });
const studentMenu = () => evaluationsMenu(VIEW_ONLY, VIEW_ONLY);

function mockGradebook() {
  const calls = {
    courseBooks: [] as { courseId: string; periodId: string | null }[],
    minePeriods: 0,
    yearPeriods: 0,
    studentBooks: [] as URLSearchParams[],
  };
  server.use(
    http.get(apiUrl('/api/teacher-assignments/mine'), () =>
      HttpResponse.json([
        assignment('a-1', course(C601, '601')),
        assignment('a-2', course(C601, '601')),
      ]),
    ),
    http.get(apiUrl('/api/teacher-assignments/mine/periods'), () => {
      calls.minePeriods += 1;
      return HttpResponse.json(PERIODS);
    }),
    http.get(apiUrl('/api/academic-years/:id/periods'), () => {
      calls.yearPeriods += 1;
      return HttpResponse.json(PERIODS);
    }),
    http.get(apiUrl('/api/gradebook/courses/:courseId'), ({ request, params }) => {
      calls.courseBooks.push({
        courseId: String(params.courseId),
        periodId: new URL(request.url).searchParams.get('periodId'),
      });
      return HttpResponse.json(COURSE_BOOK);
    }),
    http.get(apiUrl('/api/gradebook/mine'), () => HttpResponse.json(STUDENT_BOOK)),
    http.get(apiUrl('/api/gradebook/students/:id'), ({ request }) => {
      calls.studentBooks.push(new URL(request.url).searchParams);
      return HttpResponse.json(STUDENT_BOOK);
    }),
  );
  return calls;
}

describe('cuadro de notas del curso', () => {
  it('el docente elige uno de sus cursos (sin repetir) y ve definitivas, parciales y promedios', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const calls = mockGradebook();
    const user = userEvent.setup();
    renderApp('/evaluations/scores');

    expect(
      await screen.findByText('Elige el curso para ver su cuadro de notas.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Año lectivo')).not.toBeInTheDocument();
    const courseSelect = screen.getByLabelText('Curso');
    await waitFor(() => {
      // «Elige el curso» + 601 una sola vez (dos materias en el mismo curso).
      expect(within(courseSelect).getAllByRole('option')).toHaveLength(2);
    });
    await user.selectOptions(courseSelect, C601);

    const table = await screen.findByRole('table', {
      name: 'Notas del curso 601 en Segundo periodo',
    });
    // Por defecto, el periodo en curso.
    expect(calls.courseBooks.at(-1)).toEqual({ courseId: C601, periodId: P2 });
    expect(calls.minePeriods).toBeGreaterThan(0);
    expect(calls.yearPeriods).toBe(0);
    const mateo = within(table).getByRole('row', { name: /Mateo Rojas/ });
    expect(within(mateo).getByText('4,2')).toBeInTheDocument();
    expect(within(mateo).getByText('No aprueba')).toBeInTheDocument();
    expect(within(mateo).getByText('3,35')).toBeInTheDocument();
    const sara = within(table).getByRole('row', { name: /Sara López/ });
    expect(within(sara).getByText('Suspendido')).toBeInTheDocument();
    expect(within(sara).getByText('1 de 2 notas')).toBeInTheDocument();
    expect(within(sara).getByText('Sin evaluaciones')).toBeInTheDocument();
    expect(within(sara).getByText('Sin promedio')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Periodo'), P1);
    await waitFor(() => {
      expect(calls.courseBooks.at(-1)).toEqual({ courseId: C601, periodId: P1 });
    });
  });

  it('con años lectivos, elige año y curso; los periodos salen del año', async () => {
    mockSignedIn(makeSession(), [...academicMenu(), ...evaluationsMenu()]);
    const calls = mockGradebook();
    const year: AcademicYear = {
      id: Y2026,
      institutionId: 'inst-1',
      year: 2026,
      isActive: true,
      createdAt: STAMP,
    };
    server.use(
      http.get(apiUrl('/api/teacher-assignments/mine'), () => HttpResponse.json([])),
      http.get(apiUrl('/api/academic-years'), () => HttpResponse.json(page([year]))),
      http.get(apiUrl('/api/courses'), () =>
        HttpResponse.json(page([course(C601, '601'), course(C602, '602')])),
      ),
    );
    renderApp(`/evaluations/scores?course=${C602}`);

    const yearSelect = await screen.findByLabelText('Año lectivo');
    // Siempre un año: «Todos los años» dejaría el curso sin opciones (I2).
    expect(within(yearSelect).queryByRole('option', { name: 'Todos los años' })).toBeNull();
    await screen.findByRole('table', { name: 'Notas del curso 601 en Segundo periodo' });
    expect(calls.courseBooks.at(-1)?.courseId).toBe(C602);
    expect(calls.yearPeriods).toBeGreaterThan(0);
    expect(calls.minePeriods).toBe(0);
  });

  it('un periodo que no es del año del curso en la URL no se envía', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const calls = mockGradebook();
    renderApp(`/evaluations/scores?course=${C601}&period=8e9f0a1b-2c3d-4e4f-9a5b-6c7d8e9f0a1b`);
    await screen.findByRole('table', { name: 'Notas del curso 601 en Segundo periodo' });
    expect(calls.courseBooks).toEqual([{ courseId: C601, periodId: P2 }]);
  });

  it('un curso que no es suyo en la URL no se consulta', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const calls = mockGradebook();
    renderApp(`/evaluations/scores?course=${C602}`);
    expect(
      await screen.findByText('Elige el curso para ver su cuadro de notas.'),
    ).toBeInTheDocument();
    expect(calls.courseBooks).toHaveLength(0);
  });

  it('sin notas que ver en el curso (404), lo explica', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    mockGradebook();
    server.use(
      http.get(apiUrl('/api/gradebook/courses/:courseId'), () =>
        apiError(404, 'Curso no encontrado'),
      ),
    );
    renderApp(`/evaluations/scores?course=${C601}`);
    expect(
      await screen.findByText('No tienes notas que consultar en este curso.'),
    ).toBeInTheDocument();
  });
});

describe('mis notas (estudiante)', () => {
  it('el resumen del año y el detalle de las evaluaciones por periodo', async () => {
    mockSignedIn(studentSession(), studentMenu());
    mockGradebook();
    // Un estudiante no tiene carga.
    server.use(http.get(apiUrl('/api/teacher-assignments/mine'), () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderApp('/evaluations/scores');

    const table = await screen.findByRole('table', { name: 'Notas de Mateo Rojas en 2026' });
    const row = within(table).getByRole('row', { name: /Matemáticas/ });
    expect(within(row).getByText('4,0')).toBeInTheDocument();
    expect(within(row).getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByLabelText('Curso')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Segundo periodo' }));
    await user.click(await screen.findByText('Matemáticas', { selector: 'summary span' }));
    expect(await screen.findByText('Exposición')).toBeVisible();
    expect(screen.getByText('Sin nota')).toBeVisible();
  });

  it('sin matrícula en un año activo (404), lo explica', async () => {
    mockSignedIn(studentSession(), studentMenu());
    mockGradebook();
    // Un estudiante no tiene carga.
    server.use(http.get(apiUrl('/api/teacher-assignments/mine'), () => HttpResponse.json([])));
    server.use(
      http.get(apiUrl('/api/gradebook/mine'), () =>
        apiError(404, 'Sin matrícula en un año lectivo activo'),
      ),
    );
    renderApp('/evaluations/scores');
    expect(await screen.findByText('Todavía no tienes notas para mostrar.')).toBeInTheDocument();
  });

  it('un estudiante con otro rol sin cursos ni carga solo ve sus notas', async () => {
    mockSignedIn(
      makeSession({
        institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['STUDENT', 'Personero'] }],
      }),
      studentMenu(),
    );
    mockGradebook();
    server.use(http.get(apiUrl('/api/teacher-assignments/mine'), () => HttpResponse.json([])));
    renderApp('/evaluations/scores');

    expect(
      await screen.findByRole('table', { name: 'Notas de Mateo Rojas en 2026' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Cuadro de notas' })).not.toBeInTheDocument();
  });

  it('quien es estudiante y docente ve las dos vistas en pestañas', async () => {
    mockSignedIn(
      makeSession({
        institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['TEACHER', 'STUDENT'] }],
      }),
      evaluationsMenu(),
    );
    mockGradebook();
    const user = userEvent.setup();
    renderApp('/evaluations/scores');

    expect(await screen.findByRole('tab', { name: 'Cuadro de notas' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Mis notas' }));
    expect(
      await screen.findByRole('table', { name: 'Notas de Mateo Rojas en 2026' }),
    ).toBeInTheDocument();
  });
});

describe('notas en la ficha del estudiante', () => {
  const studentPath = `/people/students/${studentFixture().id}`;
  const mockStudent = () => {
    server.use(
      http.get(apiUrl('/api/students/:id'), () => HttpResponse.json(studentFixture())),
      http.get(apiUrl('/api/campuses'), () => HttpResponse.json(page([]))),
    );
  };

  it('con el permiso de ver Notas, muestra su año', async () => {
    mockSignedIn(makeSession(), [...peopleMenu(), ...evaluationsMenu()]);
    const calls = mockGradebook();
    mockStudent();
    renderApp(studentPath);

    const section = await screen.findByRole('region', { name: 'Notas' });
    expect(
      await within(section).findByRole('table', { name: 'Notas de Mateo Rojas en 2026' }),
    ).toBeInTheDocument();
    // Sin año elegido: el de su matrícula vigente.
    expect(calls.studentBooks.at(-1)?.has('academicYearId')).toBe(false);
  });

  it('un 404 (no le dicta materias) se explica sin error', async () => {
    mockSignedIn(teacherSession(), [...peopleMenu(VIEW_ONLY), ...evaluationsMenu()]);
    mockGradebook();
    mockStudent();
    server.use(
      http.get(apiUrl('/api/gradebook/students/:id'), () =>
        apiError(404, 'Estudiante no encontrado'),
      ),
    );
    renderApp(studentPath);
    expect(await screen.findByText(/no le dictas materias/)).toBeInTheDocument();
  });

  it('sin el permiso de Notas no aparece ni se pide', async () => {
    mockSignedIn(makeSession(), [
      ...peopleMenu(),
      menuNode('evaluations', 'Evaluaciones', VIEW_ONLY, []),
    ]);
    const calls = mockGradebook();
    mockStudent();
    renderApp(studentPath);
    expect(await screen.findByRole('heading', { name: /Mateo Rojas/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Notas' })).not.toBeInTheDocument();
    expect(calls.studentBooks).toHaveLength(0);
  });
});
