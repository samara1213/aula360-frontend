import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { MyInvitation, Session } from '@/api/types';
import { apiError, apiUrl, mockSignedIn } from '@/test/api';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

// La persona invitada ve en el inicio las invitaciones de otras instituciones,
// las acepta (y entra) o las rechaza.

const INVITATION_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const OTHER_ID = '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d';

const invitation = (): MyInvitation => ({
  id: INVITATION_ID,
  institution: { id: OTHER_ID, name: 'Colegio Los Andes' },
  profileType: 'TEACHER',
  campus: { id: '6c5b4a3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d', name: 'Sede Norte', isActive: true },
  createdAt: '2026-10-20T15:00:00.000Z',
  expiresAt: '2026-11-03T15:00:00.000Z',
});

const teacherSession = (extra: Session['institutions'] = []) =>
  makeSession({
    institutions: [{ id: 'inst-1', name: 'Colegio San José', roles: ['TEACHER'] }, ...extra],
    user: { userType: 'TEACHER', firstName: 'Carlos', lastName: 'Pérez' },
  });

function mockInvitations() {
  const calls = { accepted: [] as string[], rejected: [] as string[], switched: [] as unknown[] };
  let pending = [invitation()];
  let session = teacherSession();
  server.use(
    http.get(apiUrl('/api/auth/me'), () => HttpResponse.json(session)),
    http.get(apiUrl('/api/users/me/invitations'), () => HttpResponse.json(pending)),
    http.post(apiUrl('/api/users/me/invitations/:id/accept'), ({ params }) => {
      calls.accepted.push(String(params.id));
      pending = [];
      session = teacherSession([{ id: OTHER_ID, name: 'Colegio Los Andes', roles: ['TEACHER'] }]);
      return HttpResponse.json({ institutionId: OTHER_ID });
    }),
    http.post(apiUrl('/api/users/me/invitations/:id/reject'), ({ params }) => {
      calls.rejected.push(String(params.id));
      pending = [];
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(apiUrl('/api/auth/switch-institution'), async ({ request }) => {
      calls.switched.push(await request.json());
      session = { ...session, activeInstitutionId: OTHER_ID };
      return HttpResponse.json(session);
    }),
  );
  return calls;
}

describe('invitaciones de otras instituciones en el inicio', () => {
  it('sin invitaciones no se muestra nada', async () => {
    mockSignedIn(teacherSession());
    renderApp('/');

    expect(await screen.findByText(/Carlos/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Invitaciones' })).toBeNull();
  });

  it('al aceptar ya pertenece a la institución y «Entrar» cambia a ella', async () => {
    mockSignedIn(teacherSession());
    const calls = mockInvitations();
    const user = userEvent.setup();
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Invitaciones' });
    expect(within(list).getByText('Colegio Los Andes')).toBeInTheDocument();
    expect(within(list).getByText(/Como docente en Sede Norte/)).toBeInTheDocument();

    await user.click(
      within(list).getByRole('button', { name: 'Aceptar la invitación de Colegio Los Andes' }),
    );
    expect(await screen.findByText('Ya perteneces a Colegio Los Andes.')).toBeInTheDocument();
    expect(calls.accepted).toEqual([INVITATION_ID]);
    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Invitaciones' })).toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => {
      expect(calls.switched).toEqual([{ institutionId: OTHER_ID }]);
    });
  });

  it('rechazar pide confirmación', async () => {
    mockSignedIn(teacherSession());
    const calls = mockInvitations();
    const user = userEvent.setup();
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Invitaciones' });
    await user.click(
      within(list).getByRole('button', { name: 'Rechazar la invitación de Colegio Los Andes' }),
    );
    const confirm = await screen.findByRole('alertdialog', {
      name: '¿Rechazar la invitación de Colegio Los Andes?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Rechazar invitación' }));
    expect(
      await screen.findByText('Rechazaste la invitación de Colegio Los Andes.'),
    ).toBeInTheDocument();
    expect(calls.rejected).toEqual([INVITATION_ID]);
    expect(calls.accepted).toHaveLength(0);
  });

  it('si la invitación ya no vale, muestra el error del backend', async () => {
    mockSignedIn(teacherSession());
    mockInvitations();
    server.use(
      http.post(apiUrl('/api/users/me/invitations/:id/accept'), () =>
        apiError(404, 'Invitación no encontrada'),
      ),
    );
    const user = userEvent.setup();
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Invitaciones' });
    await user.click(
      within(list).getByRole('button', { name: 'Aceptar la invitación de Colegio Los Andes' }),
    );
    expect(await screen.findByText('Invitación no encontrada')).toBeInTheDocument();
  });
});
