import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { institution } from '@/test/fixtures';
import { apiUrl, FULL, institutionMenu, mockSignedIn, VIEW_ONLY } from '@/test/api';
import { makeSession, renderApp } from '@/test/render';
import { server } from '@/test/server';

function mockCurrent(current = institution()) {
  const calls = { uploads: 0 };
  server.use(
    http.get(apiUrl('/api/institutions/current'), () => HttpResponse.json(current)),
    http.put(apiUrl('/api/institutions/current/logo'), async ({ request }) => {
      const form = await request.formData();
      if (form.has('file')) calls.uploads += 1;
      return HttpResponse.json(
        institution({ logoPath: 'inst-1/logos/x.png', logoUrl: 'https://cdn.test/x.png' }),
      );
    }),
  );
  return calls;
}

describe('institución activa', () => {
  it('el grupo «Institución» del menú enlaza a sus datos, solo en su ruta exacta', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    mockCurrent();
    renderApp('/institution');

    const nav = await screen.findByRole('navigation', { name: 'Menú principal' });
    const page = await within(nav).findByRole('link', { name: 'Datos de la institución' });
    expect(page).toHaveAttribute('href', '/institution');
    expect(page).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Sedes' })).not.toHaveAttribute('aria-current');
  });

  it('muestra los datos con la escala en formato colombiano', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    mockCurrent(institution({ gradingScaleMax: 10, passingScore: 6.5 }));
    renderApp('/institution');

    expect(await screen.findByRole('heading', { name: 'Colegio San José' })).toBeInTheDocument();
    expect(screen.getByText('900123456-7')).toBeInTheDocument();
    expect(screen.getByText('De 1,0 a 10,0')).toBeInTheDocument();
    expect(screen.getByText('6,5')).toBeInTheDocument();
  });

  it('sube el logo, pero rechaza un archivo que no es imagen sin llamar a la API', async () => {
    mockSignedIn(makeSession(), institutionMenu());
    const calls = mockCurrent();
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderApp('/institution');

    await user.click(await screen.findByRole('button', { name: 'Subir logo' }));
    const input = container.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('sin input de archivo');

    await user.upload(input, new File(['%PDF'], 'logo.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('Usa una imagen JPG, PNG o WEBP.')).toBeInTheDocument();
    expect(calls.uploads).toBe(0);

    await user.upload(input, new File(['png'], 'logo.png', { type: 'image/png' }));
    expect(await screen.findByText('Logo actualizado.')).toBeInTheDocument();
    expect(calls.uploads).toBe(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Quitar logo' })).toBeInTheDocument();
    });
  });

  it('sin permiso de editar no muestra los botones del logo', async () => {
    mockSignedIn(makeSession(), institutionMenu(VIEW_ONLY, FULL));
    mockCurrent();
    renderApp('/institution');
    expect(await screen.findByText('Todavía no hay logo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subir logo' })).not.toBeInTheDocument();
  });

  it('con el rol limitado a una sede no ofrece cambiar el logo', async () => {
    mockSignedIn(makeSession(), institutionMenu(undefined, undefined, { siteOnly: true }));
    mockCurrent();
    renderApp('/institution');
    expect(await screen.findByText('Todavía no hay logo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subir logo' })).not.toBeInTheDocument();
  });

  it('sin permiso sobre la institución, ni enlace ni página', async () => {
    mockSignedIn(makeSession(), []);
    renderApp('/institution');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Datos de la institución' })).not.toBeInTheDocument();
  });
});
