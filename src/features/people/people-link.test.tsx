import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/api/errors';
import type { Invitation, Student, Teacher } from '@/api/types';
import { apiError, apiUrl, FULL, mockSignedIn, page, peopleMenu } from '@/test/api';
import { campus, student, teacher } from '@/test/fixtures';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

// Personas que ya tienen cuenta en otra institución: invitarlas desde el alta
// (tras el 409), ver y cancelar las pendientes, y quitarles el acceso a esta
// institución desde su ficha.

const NORTE = '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
const INVITATION_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const EXISTS = 'Ya existe un usuario con ese documento o email';

const invitation = (): Invitation => ({
  id: INVITATION_ID,
  displayName: 'Carlos P.',
  profileType: 'TEACHER',
  campus: { id: NORTE, name: 'Sede Norte', isActive: true },
  createdAt: '2026-10-20T15:00:00.000Z',
  expiresAt: '2026-11-03T15:00:00.000Z',
});

function mockPeople({
  teacherTarget = teacher(),
  studentTarget = student(),
  pending = [],
}: { teacherTarget?: Teacher; studentTarget?: Student; pending?: Invitation[] } = {}) {
  const calls = {
    lookups: [] as string[],
    invited: [] as unknown[],
    cancelled: [] as string[],
    removed: [] as string[],
    creates: 0,
  };
  let invitations = pending;
  server.use(
    http.get(apiUrl('/api/campuses'), () =>
      HttpResponse.json(page([campus({ id: NORTE, name: 'Sede Norte' })])),
    ),
    http.get(apiUrl('/api/teachers'), () => HttpResponse.json(page([teacherTarget]))),
    http.get(apiUrl('/api/teachers/link-candidate'), ({ request }) => {
      calls.lookups.push(new URL(request.url).search);
      return HttpResponse.json({ displayName: 'Carlos P.' });
    }),
    http.get(apiUrl('/api/teachers/invitations'), () => HttpResponse.json(invitations)),
    http.post(apiUrl('/api/teachers/invitations'), async ({ request }) => {
      calls.invited.push(await request.json());
      invitations = [invitation()];
      return HttpResponse.json(invitation(), { status: 201 });
    }),
    http.delete(apiUrl('/api/teachers/invitations/:invitationId'), ({ params }) => {
      calls.cancelled.push(String(params.invitationId));
      invitations = [];
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(apiUrl('/api/teachers/:id'), ({ params }) =>
      params.id === teacherTarget.id
        ? HttpResponse.json(teacherTarget)
        : apiError(404, 'Docente no encontrado'),
    ),
    http.post(apiUrl('/api/teachers'), () => {
      calls.creates += 1;
      return apiError(409, EXISTS, ERROR_CODES.USER_ALREADY_EXISTS);
    }),
    http.get(apiUrl('/api/students'), () => HttpResponse.json(page([studentTarget]))),
    http.get(apiUrl('/api/students/invitations'), () => HttpResponse.json([])),
    http.get(apiUrl('/api/students/:id'), ({ params }) =>
      params.id === studentTarget.id
        ? HttpResponse.json(studentTarget)
        : apiError(404, 'Estudiante no encontrado'),
    ),
    // El código repetido es otro 409: sin el código USER_ALREADY_EXISTS.
    http.post(apiUrl('/api/students'), () =>
      apiError(409, 'Ya existe un estudiante con ese código en la institución'),
    ),
    http.delete(apiUrl('/api/users/:id/institution-access'), ({ params }) => {
      calls.removed.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

async function openTeacherDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Nuevo docente' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nuevo docente' });
  await user.type(within(dialog).getByLabelText('Número de documento'), '80123456');
  await user.type(within(dialog).getByLabelText('Nombres'), 'Carlos');
  await user.type(within(dialog).getByLabelText('Apellidos'), 'Pérez');
  await user.type(within(dialog).getByLabelText('Especialidad (opcional)'), 'Álgebra');
  await user.selectOptions(within(dialog).getByLabelText('Sede'), NORTE);
  await user.click(within(dialog).getByRole('button', { name: 'Crear docente' }));
  return dialog;
}

describe('invitar a quien ya tiene cuenta en otra institución', () => {
  it('tras el 409 busca su cuenta, muestra «Carlos P.» y le envía la invitación con la sede', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockPeople();
    const user = userEvent.setup();
    renderApp('/people/teachers');

    const dialog = await openTeacherDialog(user);
    const panel = await within(dialog).findByRole('region', { name: 'Cuenta existente' });
    await user.click(within(panel).getByRole('button', { name: 'Buscar su cuenta' }));
    expect(await within(panel).findByText('Carlos P.')).toBeInTheDocument();
    expect(calls.lookups).toEqual(['?documentType=CC&documentNumber=80123456']);

    await user.click(within(panel).getByRole('button', { name: 'Enviar invitación' }));
    expect(
      await screen.findByText(
        'Invitación enviada a Carlos P.: al entrar a Aula360 la acepta o la rechaza.',
      ),
    ).toBeInTheDocument();
    // Los botones del panel van dentro del formulario del alta: no lo envían de nuevo.
    expect(calls.creates).toBe(1);
    // Solo el documento y la sede: ni nombres, ni correo, ni datos de la ficha.
    expect(calls.invited).toEqual([
      { documentType: 'CC', documentNumber: '80123456', campusId: NORTE },
    ]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Nuevo docente' })).toBeNull();
    });
    // Queda en las pendientes, con el nombre corto.
    const list = await screen.findByRole('list', { name: 'Invitaciones pendientes' });
    expect(within(list).getByText('Carlos P.')).toBeInTheDocument();
  });

  it('si no se puede invitar (otro tipo de usuario), lo explica y no ofrece enviarla', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    mockPeople();
    server.use(
      http.get(apiUrl('/api/teachers/link-candidate'), () =>
        apiError(409, 'Esta persona no se puede invitar como docente'),
      ),
    );
    const user = userEvent.setup();
    renderApp('/people/teachers');

    const dialog = await openTeacherDialog(user);
    const panel = await within(dialog).findByRole('region', { name: 'Cuenta existente' });
    await user.click(within(panel).getByRole('button', { name: 'Buscar su cuenta' }));
    expect(await within(panel).findByText(/no se puede invitar/)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Enviar invitación' })).toBeNull();
  });

  it('«No es esta persona» vuelve a la búsqueda sin invitar', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockPeople();
    const user = userEvent.setup();
    renderApp('/people/teachers');

    const dialog = await openTeacherDialog(user);
    const panel = await within(dialog).findByRole('region', { name: 'Cuenta existente' });
    await user.click(within(panel).getByRole('button', { name: 'Buscar su cuenta' }));
    await user.click(await within(panel).findByRole('button', { name: 'No es esta persona' }));
    expect(within(panel).getByRole('button', { name: 'Buscar su cuenta' })).toBeInTheDocument();
    expect(calls.invited).toHaveLength(0);
  });

  it('un 409 sin el código de cuenta existente (código del estudiante) no ofrece buscarla', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    mockPeople();
    const user = userEvent.setup();
    renderApp('/people/students');

    await user.click(await screen.findByRole('button', { name: 'Nuevo estudiante' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo estudiante' });
    await user.type(within(dialog).getByLabelText('Número de documento'), '1012345678');
    await user.type(within(dialog).getByLabelText('Nombres'), 'Sara');
    await user.type(within(dialog).getByLabelText('Apellidos'), 'Ruiz');
    await user.selectOptions(within(dialog).getByLabelText('Sede'), NORTE);
    await user.click(within(dialog).getByRole('button', { name: 'Crear estudiante' }));
    expect(await within(dialog).findByText(/código en la institución/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('region', { name: 'Cuenta existente' })).toBeNull();
  });
});

describe('invitaciones pendientes', () => {
  it('muestran el nombre corto y la sede, y se cancelan con confirmación', async () => {
    mockSignedIn(makeSession(), peopleMenu());
    const calls = mockPeople({ pending: [invitation()] });
    const user = userEvent.setup();
    renderApp('/people/teachers');

    const list = await screen.findByRole('list', { name: 'Invitaciones pendientes' });
    expect(within(list).getByText('Carlos P.')).toBeInTheDocument();
    expect(within(list).getByText(/Sede Norte/)).toBeInTheDocument();

    await user.click(
      within(list).getByRole('button', { name: 'Cancelar la invitación de Carlos P.' }),
    );
    const confirm = await screen.findByRole('alertdialog', {
      name: '¿Cancelar la invitación de Carlos P.?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar invitación' }));
    expect(await screen.findByText('Invitación de Carlos P. cancelada.')).toBeInTheDocument();
    expect(calls.cancelled).toEqual([INVITATION_ID]);
    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Invitaciones pendientes' })).toBeNull();
    });
  });

  it('sin permiso de crear no se muestran', async () => {
    mockSignedIn(makeSession(), peopleMenu({ ...FULL, create: false }));
    mockPeople({ pending: [invitation()] });
    renderApp('/people/teachers');

    expect((await screen.findAllByText(/Laura/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('list', { name: 'Invitaciones pendientes' })).toBeNull();
  });
});

describe('ficha de una persona que también está en otra institución', () => {
  it('sus datos personales son de solo lectura y solo se le quita el acceso aquí', async () => {
    mockSignedIn(makeSession(), peopleMenu(FULL, { users: FULL }));
    const calls = mockPeople({ teacherTarget: { ...teacher(), sharedElsewhere: true } });
    const user = userEvent.setup();
    const { router } = renderApp(`/people/teachers/${teacher().id}`);

    expect(
      await screen.findByText(/también está en otra institución: su nombre, documento/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombres')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Tipo de documento')).toHaveAttribute('readonly');
    // El perfil de esta institución sí se edita.
    expect(screen.getByLabelText('Especialidad (opcional)')).not.toHaveAttribute('readonly');
    // La cuenta es de varias instituciones: ni desactivar ni contraseña temporal.
    expect(screen.queryByRole('button', { name: 'Desactivar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nueva contraseña temporal' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Quitar acceso en esta institución' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: '¿Quitar a Laura Gómez de esta institución?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Quitar acceso' }));
    expect(
      await screen.findByText('Laura Gómez ya no tiene acceso a esta institución.'),
    ).toBeInTheDocument();
    expect(calls.removed).toEqual([teacher().user.id]);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/people/teachers');
    });
  });

  it('si solo está en esta institución, todo sigue igual (desactivar y datos editables)', async () => {
    mockSignedIn(makeSession(), peopleMenu(FULL, { users: FULL }));
    mockPeople({ teacherTarget: { ...teacher(), sharedElsewhere: false } });
    renderApp(`/people/teachers/${teacher().id}`);

    expect(await screen.findByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar acceso en esta institución' })).toBeNull();
    expect(screen.getByLabelText('Nombres')).not.toHaveAttribute('readonly');
  });
});
