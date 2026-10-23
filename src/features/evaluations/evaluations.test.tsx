import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type {
  AcademicYear,
  Course,
  Evaluation,
  EvaluationScores,
  Period,
  ScoreStudent,
  TeacherAssignment,
} from '@/api/types';
import {
  academicMenu,
  apiError,
  apiUrl,
  evaluationsMenu,
  FULL,
  mockSignedIn,
  page,
  VIEW_ONLY,
} from '@/test/api';
import { teacher } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

const STAMP = '2026-01-10T15:00:00.000Z';
const Y2026 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const NORTE = '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
const SEXTO = '3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d6e';
const MATE = '5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a';
const FISICA = '2e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a6b';
const C601 = '6e7f8a9b-0c1d-4e2f-9a3b-4c5d6e7f8a9b';
const A_MATE = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const A_FISICA = '8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1e';
const P_PAST = '9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const P_NOW = '0d1e2f3a-4b5c-4d6e-9f7a-8b9c0d1e2f3a';
const E1 = '1e2f3a4b-5c6d-4e7f-8a8b-9c0d1e2f3a4b';
const E2 = '2f3a4b5c-6d7e-4f8a-9b9c-0d1e2f3a4b5c';
const S1 = '3a4b5c6d-7e8f-4a9b-8c0d-1e2f3a4b5c6d';
const S2 = '4b5c6d7e-8f9a-4b0c-9d1e-2f3a4b5c6d7e';
const S3 = '5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f';

const course: Course = {
  id: C601,
  name: '601',
  grade: { id: SEXTO, name: 'Sexto' },
  campus: { id: NORTE, name: 'Sede Norte', isActive: true },
  academicYear: { id: Y2026, year: 2026, isActive: true },
  createdAt: STAMP,
};

const assignment = (
  id: string,
  subject: { id: string; name: string },
  overrides: Partial<TeacherAssignment> = {},
): TeacherAssignment => ({
  id,
  isActive: true,
  course,
  subject,
  teacher: { id: teacher().id, userId: teacher().user.id, firstName: 'Laura', lastName: 'Gómez' },
  createdAt: STAMP,
  deactivatedAt: null,
  ...overrides,
});

const MINE = [
  assignment(A_MATE, { id: MATE, name: 'Matemáticas' }),
  assignment(A_FISICA, { id: FISICA, name: 'Física' }),
];

// Periodos que no dependen de la fecha de hoy: uno ya terminó, el otro está en curso.
const period = (id: string, name: string, startDate: string, endDate: string): Period => ({
  id,
  academicYearId: Y2026,
  name,
  startDate,
  endDate,
  createdAt: STAMP,
});
const PERIODS = [
  period(P_PAST, 'Periodo pasado', '2000-01-10', '2000-04-10'),
  period(P_NOW, 'Periodo actual', '2000-05-01', '2999-12-31'),
];

const evaluation = (
  id: string,
  title: string,
  percentage: number,
  overrides: Partial<Evaluation> = {},
): Evaluation => {
  const a = MINE[0] as TeacherAssignment;
  return {
    id,
    title,
    percentage,
    evaluationDate: '2026-03-10',
    period: { id: P_NOW, name: 'Periodo actual', startDate: '2000-05-01', endDate: '2999-12-31' },
    teacherAssignment: {
      id: a.id,
      isActive: true,
      course: { id: C601, name: '601' },
      subject: a.subject,
      teacher: a.teacher,
    },
    createdAt: STAMP,
    ...overrides,
  };
};

const teacherSession = () =>
  makeSession({
    institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['TEACHER'] }],
    user: { userType: 'TEACHER', firstName: 'Laura', lastName: 'Gómez' },
  });

/** API de evaluaciones falsa: guarda las consultas y lo que llega en cada escritura. */
function mockEvaluations({
  mine = MINE,
  canAdminister = false,
}: { mine?: TeacherAssignment[]; canAdminister?: boolean } = {}) {
  const evaluations = [evaluation(E1, 'Taller 1', 40), evaluation(E2, 'Quiz', 20)];
  const calls = {
    evaluationQueries: [] as URLSearchParams[],
    created: [] as unknown[],
    patched: [] as unknown[],
    deleted: [] as string[],
    minePeriods: 0,
    yearPeriods: 0,
  };
  server.use(
    http.get(apiUrl('/api/teacher-assignments/mine'), () => HttpResponse.json(mine)),
    http.get(apiUrl('/api/teacher-assignments/mine/periods'), () => {
      calls.minePeriods += 1;
      return HttpResponse.json(PERIODS);
    }),
    http.get(apiUrl('/api/academic-years/:id/periods'), () => {
      calls.yearPeriods += 1;
      return HttpResponse.json(PERIODS);
    }),
    http.get(apiUrl('/api/evaluations'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.evaluationQueries.push(params);
      return HttpResponse.json({
        ...page(
          params.get('periodId') === P_NOW && params.get('subjectId') === MATE ? evaluations : [],
        ),
        ...(params.get('courseId') ? { canAdminister } : {}),
      });
    }),
    http.post(apiUrl('/api/evaluations'), async ({ request }) => {
      const body = (await request.json()) as { title: string; percentage: number };
      calls.created.push(body);
      const created = evaluation(
        '6d7e8f9a-0b1c-4d2e-9f3a-4b5c6d7e8f9a',
        body.title,
        body.percentage,
      );
      evaluations.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl('/api/evaluations/:id'), async ({ request, params }) => {
      calls.patched.push(await request.json());
      return HttpResponse.json(evaluations.find((e) => e.id === params.id));
    }),
    http.delete(apiUrl('/api/evaluations/:id'), ({ params }) => {
      calls.deleted.push(String(params.id));
      return apiError(409, 'La evaluación tiene notas: no se puede eliminar');
    }),
  );
  return calls;
}

describe('evaluaciones del docente', () => {
  it('elige una de sus cargas, ve la suma de porcentajes y crea una evaluación', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const calls = mockEvaluations();
    const user = userEvent.setup();
    const { router } = renderApp('/evaluations/evaluations');

    const mine = await screen.findByRole('region', { name: 'Mis cargas' });
    await user.click(within(mine).getByRole('button', { name: /Matemáticas/ }));
    expect(router.state.location.search).toContain(`assignment=${A_MATE}`);

    const table = await screen.findByRole('table', {
      name: 'Evaluaciones de Matemáticas en Periodo actual',
    });
    expect(within(table).getByRole('rowheader', { name: 'Taller 1' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Porcentaje asignado' })).toHaveAttribute(
      'aria-valuenow',
      '60',
    );
    expect(screen.getByText('Faltan 40 % para completar el periodo.')).toBeInTheDocument();
    // Periodos por la ruta del docente (sin permiso de ver Periodos).
    expect(calls.minePeriods).toBeGreaterThan(0);
    expect(calls.yearPeriods).toBe(0);
    const query = calls.evaluationQueries.at(-1);
    expect(query?.get('courseId')).toBe(C601);
    expect(query?.get('periodId')).toBe(P_NOW);

    await user.click(screen.getByRole('button', { name: 'Nueva evaluación' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva evaluación' });
    await user.type(within(dialog).getByLabelText('Título'), 'Exposición');
    await user.type(within(dialog).getByLabelText('Porcentaje'), '45');
    fireEvent.change(within(dialog).getByLabelText('Fecha'), { target: { value: '2026-05-04' } });
    await user.click(within(dialog).getByRole('button', { name: 'Crear evaluación' }));
    expect(
      await within(dialog).findByText('Solo queda 40 % disponible en este periodo.'),
    ).toBeInTheDocument();
    expect(calls.created).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('Porcentaje'));
    await user.type(within(dialog).getByLabelText('Porcentaje'), '12,5');
    await user.click(within(dialog).getByRole('button', { name: 'Crear evaluación' }));
    await waitFor(() => {
      expect(calls.created).toEqual([
        {
          title: 'Exposición',
          percentage: 12.5,
          evaluationDate: '2026-05-04',
          teacherAssignmentId: A_MATE,
          periodId: P_NOW,
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('periodo terminado: solo lectura, sin crear ni editar', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    mockEvaluations();
    const user = userEvent.setup();
    renderApp(`/evaluations/evaluations?assignment=${A_MATE}`);

    const select = await screen.findByLabelText('Periodo');
    await user.selectOptions(select, P_PAST);
    expect(
      await screen.findByText(
        'El periodo ya terminó: solo la administración puede cambiar sus evaluaciones.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva evaluación' })).not.toBeInTheDocument();
    expect(
      await screen.findByText('Este periodo todavía no tiene evaluaciones.'),
    ).toBeInTheDocument();
  });

  it('si el backend dice que administra la sede del curso, sí puede en un periodo terminado', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    mockEvaluations({ canAdminister: true });
    const user = userEvent.setup();
    renderApp(`/evaluations/evaluations?assignment=${A_MATE}`);

    await user.selectOptions(await screen.findByLabelText('Periodo'), P_PAST);
    expect(await screen.findByRole('button', { name: 'Nueva evaluación' })).toBeInTheDocument();
    expect(screen.queryByText(/El periodo ya terminó/)).not.toBeInTheDocument();
  });

  it('una carga que no es suya en la URL no se muestra', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const calls = mockEvaluations();
    renderApp('/evaluations/evaluations?assignment=9d0e1f2a-3b4c-4d5e-9f6a-7b8c9d0e1f2b');

    expect(
      await screen.findByText('Elige una de tus cargas para ver sus evaluaciones.'),
    ).toBeInTheDocument();
    expect(calls.evaluationQueries).toHaveLength(0);
  });

  it('sin carga activa lo explica', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    mockEvaluations({ mine: [] });
    renderApp('/evaluations/evaluations');
    expect(await screen.findByText('No tienes carga académica activa.')).toBeInTheDocument();
  });

  it('eliminar una evaluación con notas: el 409 se muestra', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const calls = mockEvaluations();
    const user = userEvent.setup();
    renderApp(`/evaluations/evaluations?assignment=${A_MATE}&period=${P_NOW}`);

    const table = await screen.findByRole('table', {
      name: 'Evaluaciones de Matemáticas en Periodo actual',
    });
    await user.click(within(table).getByRole('button', { name: 'Acciones de Quiz' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar evaluación' }));
    await waitFor(() => {
      expect(calls.deleted).toEqual([E2]);
    });
    expect(
      await screen.findByText('La evaluación tiene notas: no se puede eliminar'),
    ).toBeInTheDocument();
  });

  it('editar solo envía lo que cambió', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const calls = mockEvaluations();
    const user = userEvent.setup();
    renderApp(`/evaluations/evaluations?assignment=${A_MATE}&period=${P_NOW}`);

    const table = await screen.findByRole('table', {
      name: 'Evaluaciones de Matemáticas en Periodo actual',
    });
    await user.click(within(table).getByRole('button', { name: 'Acciones de Taller 1' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar evaluación' });
    // Disponible: 100 − 20 (las demás) = 80.
    expect(within(dialog).getByText('Disponible: 80 %.')).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Porcentaje'));
    await user.type(within(dialog).getByLabelText('Porcentaje'), '50');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => {
      expect(calls.patched).toEqual([{ percentage: 50 }]);
    });
  });
});

describe('evaluaciones del administrador', () => {
  it('elige año, curso y materia; los periodos salen del año', async () => {
    mockSignedIn(makeSession(), [...academicMenu(), ...evaluationsMenu()]);
    const calls = mockEvaluations({ mine: [], canAdminister: true });
    const year: AcademicYear = {
      id: Y2026,
      institutionId: 'inst-1',
      year: 2026,
      isActive: true,
      createdAt: STAMP,
    };
    const assignmentQueries: URLSearchParams[] = [];
    server.use(
      http.get(apiUrl('/api/academic-years'), () => HttpResponse.json(page([year]))),
      http.get(apiUrl('/api/courses'), () => HttpResponse.json(page([course]))),
      http.get(apiUrl('/api/teacher-assignments'), ({ request }) => {
        assignmentQueries.push(new URL(request.url).searchParams);
        return HttpResponse.json(page(MINE));
      }),
    );
    const user = userEvent.setup();
    renderApp('/evaluations/evaluations');

    expect(
      await screen.findByText('Elige el curso y la materia para ver sus evaluaciones.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Mis cargas' })).not.toBeInTheDocument();
    const courseSelect = await screen.findByLabelText('Curso');
    await waitFor(() => {
      expect(within(courseSelect).getAllByRole('option')).toHaveLength(2);
    });
    await user.selectOptions(courseSelect, C601);
    const subject = await screen.findByLabelText('Materia');
    await waitFor(() => {
      expect(within(subject).getAllByRole('option')).toHaveLength(3);
    });
    await user.selectOptions(subject, A_MATE);

    expect(
      await screen.findByRole('table', { name: 'Evaluaciones de Matemáticas en Periodo actual' }),
    ).toBeInTheDocument();
    expect(assignmentQueries.at(-1)?.get('courseId')).toBe(C601);
    expect(assignmentQueries.at(-1)?.get('isActive')).toBe('true');
    expect(calls.yearPeriods).toBeGreaterThan(0);
    expect(calls.minePeriods).toBe(0);
    expect(screen.getByRole('button', { name: 'Nueva evaluación' })).toBeInTheDocument();
  });

  it('sin permiso de Evaluaciones no entra', async () => {
    mockSignedIn(makeSession(), academicMenu(VIEW_ONLY));
    renderApp('/evaluations/evaluations');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
  });
});

// ─── Planilla de notas ─────────────────────────────────────────────────────

const scoreRow = (
  studentId: string,
  firstName: string,
  lastName: string,
  score: number | null,
  enrollmentStatus: ScoreStudent['enrollmentStatus'] = 'ENROLLED',
): ScoreStudent => ({
  studentId,
  firstName,
  lastName,
  enrollmentStatus,
  score,
  status: score === null ? 'PENDING' : 'GRADED',
  updatedAt: score === null ? null : STAMP,
});

function mockSheet(overrides: Partial<EvaluationScores> = {}) {
  const sheet: EvaluationScores = {
    evaluation: evaluation(E1, 'Taller 1', 40),
    scale: { min: 1, max: 5, passingScore: 3 },
    students: [
      scoreRow(S1, 'Mateo', 'Rojas', null),
      scoreRow(S2, 'Sara', 'López', 3.5),
      scoreRow(S3, 'Juan', 'Martínez', 2, 'DROPPED'),
    ],
    canAdminister: false,
    lockedReason: null,
    ...overrides,
  };
  const puts: unknown[] = [];
  let reply: (() => Response) | undefined;
  server.use(
    http.get(apiUrl('/api/evaluations/:id/scores'), () => HttpResponse.json(sheet)),
    http.put(apiUrl('/api/evaluations/:id/scores'), async ({ request }) => {
      const body = (await request.json()) as {
        scores: { studentId: string; score: number | null }[];
      };
      puts.push(body);
      if (reply) return reply();
      sheet.students = sheet.students.map((s) => {
        const entry = body.scores.find((e) => e.studentId === s.studentId);
        return entry ? { ...s, score: entry.score } : s;
      });
      // Lo guardado queda para el GET siguiente (la planilla se recarga).
      // El PUT no trae canAdminister ni lockedReason (solo el GET).
      return HttpResponse.json({
        evaluation: sheet.evaluation,
        scale: sheet.scale,
        students: sheet.students,
      });
    }),
  );
  return {
    puts,
    failWith: (next: () => Response) => {
      reply = next;
    },
  };
}

const sheetPath = `/evaluations/evaluations/${E1}/scores`;

/** El enlace para volver (el menú lateral también tiene «Evaluaciones»). */
const backLink = () =>
  screen
    .getAllByRole('link', { name: 'Evaluaciones' })
    .find((link) => link.getAttribute('href')?.includes('assignment=')) as HTMLElement;

describe('planilla de notas', () => {
  it('valida, guarda solo lo que cambió y muestra el resumen', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const sheet = mockSheet();
    const user = userEvent.setup();
    renderApp(sheetPath);

    expect(await screen.findByRole('heading', { name: 'Taller 1' })).toBeInTheDocument();
    expect(screen.getByText('1 de 2 matriculados')).toBeInTheDocument();
    // El retirado no se edita: su nota se muestra.
    expect(screen.queryByLabelText('Nota de Juan Martínez')).not.toBeInTheDocument();
    expect(screen.getByText('Retirado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar nota/ })).not.toBeInTheDocument();

    const mateo = screen.getByLabelText('Nota de Mateo Rojas');
    const sara = screen.getByLabelText('Nota de Sara López');
    expect(sara).toHaveValue('3,5');
    await user.type(mateo, '6');
    expect(await screen.findByText('Debe estar entre 1,0 y 5,0.')).toBeInTheDocument();
    expect(mateo).toHaveAttribute('aria-invalid', 'true');
    await user.clear(sara);
    await user.type(sara, '4,25');
    await user.click(screen.getByRole('button', { name: 'Guardar notas' }));
    expect(
      await screen.findByText('Corrige las notas marcadas antes de guardar.'),
    ).toBeInTheDocument();
    expect(sheet.puts).toHaveLength(0);

    await user.clear(mateo);
    await user.type(mateo, '4,5');
    expect(screen.getByText('2 cambios sin guardar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar notas' }));
    await waitFor(() => {
      expect(sheet.puts).toEqual([
        {
          scores: [
            { studentId: S1, score: 4.5 },
            { studentId: S2, score: 4.25 },
          ],
        },
      ]);
    });
    expect(
      await screen.findByText('Sin cambios. Escribe las notas y guárdalas juntas.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 de 2 matriculados')).toBeInTheDocument();
    expect(screen.getByLabelText('Nota de Mateo Rojas')).toHaveValue('4,5');
  });

  it('Enter pasa a la fila siguiente y pegar una columna llena varias filas', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    mockSheet();
    const user = userEvent.setup();
    renderApp(sheetPath);

    const mateo = await screen.findByLabelText('Nota de Mateo Rojas');
    const sara = screen.getByLabelText('Nota de Sara López');
    await user.click(mateo);
    await user.keyboard('{Enter}');
    expect(sara).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(mateo).toHaveFocus();

    await user.paste('4\r\n2,5\n');
    expect(mateo).toHaveValue('4');
    expect(sara).toHaveValue('2,5');
  });

  it('un 400 marca la fila con su error y no guarda nada', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    const sheet = mockSheet();
    sheet.failWith(() =>
      HttpResponse.json(
        {
          statusCode: 400,
          message: [`scores[0] (${S1}): el estudiante no tiene matrícula vigente en el curso`],
        },
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    renderApp(sheetPath);

    await user.type(await screen.findByLabelText('Nota de Mateo Rojas'), '4');
    await user.click(screen.getByRole('button', { name: 'Guardar notas' }));
    expect(
      await screen.findByText('No se guardó ninguna nota: revisa las filas marcadas.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El estudiante no tiene matrícula vigente en el curso.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nota de Mateo Rojas')).toHaveAttribute('aria-invalid', 'true');
  });

  it('bloqueada: solo lectura con el motivo', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    mockSheet({
      lockedReason: 'El periodo ya terminó: solo un administrador puede corregir sus notas',
    });
    renderApp(sheetPath);

    expect(
      await screen.findByText(
        /El periodo ya terminó: solo un administrador puede corregir sus notas/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar notas' })).not.toBeInTheDocument();
    expect(screen.getByText('3,5')).toBeInTheDocument();
  });

  it('sin el permiso para escribir en la respuesta, solo lectura', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    // undefined no viaja en el JSON: la respuesta llega sin lockedReason.
    mockSheet({ lockedReason: undefined });
    renderApp(sheetPath);
    expect(
      await screen.findByText(/No pudimos comprobar si puedes registrar notas/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('el administrador quita la nota de un retirado', async () => {
    mockSignedIn(makeSession(), evaluationsMenu(FULL, FULL));
    const sheet = mockSheet({ canAdminister: true });
    const user = userEvent.setup();
    renderApp(sheetPath);

    await user.click(await screen.findByRole('button', { name: 'Quitar nota de Juan Martínez' }));
    expect(screen.getByText('Se quitará al guardar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar notas' }));
    await waitFor(() => {
      expect(sheet.puts).toEqual([{ scores: [{ studentId: S3, score: null }] }]);
    });
  });

  it('salir con cambios sin guardar pide confirmación', async () => {
    mockSignedIn(teacherSession(), evaluationsMenu());
    mockEvaluations();
    mockSheet();
    const user = userEvent.setup();
    const { router } = renderApp(sheetPath);

    await user.type(await screen.findByLabelText('Nota de Mateo Rojas'), '4');
    await user.click(backLink());
    const confirm = await screen.findByRole('alertdialog', {
      name: '¿Salir sin guardar las notas?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(router.state.location.pathname).toBe(sheetPath);
    expect(screen.getByLabelText('Nota de Mateo Rojas')).toHaveValue('4');

    await user.click(backLink());
    await user.click(
      within(
        await screen.findByRole('alertdialog', { name: '¿Salir sin guardar las notas?' }),
      ).getByRole('button', { name: 'Salir sin guardar' }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/evaluations/evaluations');
    });
    expect(router.state.location.search).toContain(`assignment=${A_MATE}`);
  });

  it('sin permiso de Notas, la planilla no existe', async () => {
    mockSignedIn(
      teacherSession(),
      evaluationsMenu(FULL, { view: false, create: false, update: false, delete: false }),
    );
    renderApp(sheetPath);
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
  });
});

describe('cambio de institución', () => {
  it('las cargas de la institución anterior no se muestran mientras cargan las de la nueva', async () => {
    const institutions = [
      { id: 'inst-1', name: 'Colegio San José', roles: ['TEACHER'] },
      { id: 'inst-2', name: 'Colegio La Esperanza', roles: ['TEACHER'] },
    ];
    let session = teacherSession();
    session = { ...session, institutions };
    server.use(
      http.get(apiUrl('/api/auth/me'), () => HttpResponse.json(session)),
      http.get(apiUrl('/api/menu-options/my-menu'), () => HttpResponse.json(evaluationsMenu())),
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
      http.get(apiUrl('/api/teacher-assignments/mine'), async () => {
        if (session.activeInstitutionId === 'inst-1') return HttpResponse.json(MINE);
        await gate;
        return HttpResponse.json([assignment(A_FISICA, { id: FISICA, name: 'Química' })]);
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/evaluations/evaluations');

    const mine = await screen.findByRole('region', { name: 'Mis cargas' });
    expect(within(mine).getByRole('button', { name: /Matemáticas/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cambiar de institución/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Colegio La Esperanza' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    await router.navigate('/evaluations/evaluations');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Evaluaciones', level: 1 })).toBeInTheDocument();
    });
    expect(screen.queryByText('Matemáticas')).not.toBeInTheDocument();

    release();
    expect(
      await within(await screen.findByRole('region', { name: 'Mis cargas' })).findByRole('button', {
        name: /Química/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Matemáticas')).not.toBeInTheDocument();
  });
});
