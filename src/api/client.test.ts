import { http, HttpResponse } from 'msw';
import { makeSession } from '@/test/render';
import { server } from '@/test/server';
import { api, setSessionHooks, unwrap, type SessionHooks } from './client';
import { ApiError } from './errors';

const url = (path: string) => new URL(path, window.location.origin).toString();
const unauthorized = (code?: string) =>
  HttpResponse.json({ statusCode: 401, message: 'No autorizado', code }, { status: 401 });

function useHooks(overrides: Partial<SessionHooks> = {}) {
  const hooks = {
    expired: vi.fn(),
    activeInstitution: vi.fn(() => 'inst-1'),
    institutionChanged: vi.fn(),
    ...overrides,
  };
  setSessionHooks(hooks);
  return hooks;
}

afterEach(() => {
  setSessionHooks(null);
});

describe('cliente de la API', () => {
  it('ante varios 401 a la vez hace una sola renovación y repite cada petición', async () => {
    useHooks();
    let refreshes = 0;
    let renewed = false;
    server.use(
      http.post(url('/api/auth/refresh-token'), async () => {
        refreshes++;
        await new Promise((r) => setTimeout(r, 20));
        renewed = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(url('/api/auth/me'), () => HttpResponse.json(makeSession())),
      http.get(url('/api/menu-options/my-menu'), () =>
        renewed ? HttpResponse.json([]) : unauthorized(),
      ),
    );

    const results = await Promise.all([
      unwrap(api.GET('/api/menu-options/my-menu')),
      unwrap(api.GET('/api/menu-options/my-menu')),
      unwrap(api.GET('/api/menu-options/my-menu')),
    ]);
    expect(refreshes).toBe(1);
    expect(results).toEqual([[], [], []]);
  });

  it('no renueva otra vez si otra pestaña acaba de hacerlo (A1)', async () => {
    useHooks();
    localStorage.setItem('aula360.refreshedAt', String(Date.now()));
    const refresh = vi.fn(() => new HttpResponse(null, { status: 204 }));
    let calls = 0;
    server.use(
      http.post(url('/api/auth/refresh-token'), refresh),
      http.get(url('/api/auth/me'), () => HttpResponse.json(makeSession())),
      http.get(url('/api/menu-options/my-menu'), () =>
        ++calls === 1 ? unauthorized() : HttpResponse.json([]),
      ),
    );
    await expect(unwrap(api.GET('/api/menu-options/my-menu'))).resolves.toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('si el backend dice que el token ya se rotó (otra pestaña), repite sin cerrar la sesión', async () => {
    const hooks = useHooks();
    let calls = 0;
    server.use(
      http.post(url('/api/auth/refresh-token'), () => unauthorized('REFRESH_TOKEN_ROTATED')),
      http.get(url('/api/auth/me'), () => HttpResponse.json(makeSession())),
      http.get(url('/api/menu-options/my-menu'), () =>
        ++calls === 1 ? unauthorized() : HttpResponse.json([]),
      ),
    );
    await expect(unwrap(api.GET('/api/menu-options/my-menu'))).resolves.toEqual([]);
    expect(hooks.expired).not.toHaveBeenCalled();
  });

  it('repite también el cuerpo de un POST tras renovar', async () => {
    useHooks();
    let renewed = false;
    const bodies: unknown[] = [];
    server.use(
      http.post(url('/api/auth/refresh-token'), () => {
        renewed = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(url('/api/auth/me'), () => HttpResponse.json(makeSession())),
      http.post(url('/api/auth/switch-institution'), async ({ request }) => {
        bodies.push(await request.json());
        return renewed ? HttpResponse.json({ ok: true }) : unauthorized();
      }),
    );
    await unwrap(api.POST('/api/auth/switch-institution', { body: { institutionId: 'abc' } }));
    expect(bodies).toEqual([{ institutionId: 'abc' }, { institutionId: 'abc' }]);
  });

  it('si tras renovar cambió la institución activa, no repite la petición (M1)', async () => {
    const hooks = useHooks();
    const writes: unknown[] = [];
    const moved = makeSession({ activeInstitutionId: null });
    server.use(
      http.post(url('/api/auth/refresh-token'), () => new HttpResponse(null, { status: 204 })),
      http.get(url('/api/auth/me'), () => HttpResponse.json(moved)),
      http.post(url('/api/auth/switch-institution'), async ({ request }) => {
        writes.push(await request.json());
        return unauthorized();
      }),
    );
    const error = await unwrap(
      api.POST('/api/auth/switch-institution', { body: { institutionId: 'abc' } }),
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409 });
    expect(writes).toHaveLength(1);
    expect(hooks.institutionChanged).toHaveBeenCalledWith(moved);
  });

  it('si la renovación responde 401, avisa que la sesión terminó', async () => {
    const hooks = useHooks();
    server.use(
      http.post(url('/api/auth/refresh-token'), () => unauthorized()),
      http.get(url('/api/menu-options/my-menu'), () => unauthorized()),
    );
    await expect(unwrap(api.GET('/api/menu-options/my-menu'))).rejects.toMatchObject({
      status: 401,
    });
    expect(hooks.expired).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['un 503', () => HttpResponse.json({ statusCode: 503 }, { status: 503 })],
    ['un 429', () => HttpResponse.json({ statusCode: 429 }, { status: 429 })],
    ['un error de red', () => HttpResponse.error()],
  ])('si la renovación falla por %s no cierra la sesión (M4)', async (_, failure) => {
    const hooks = useHooks();
    server.use(
      http.post(url('/api/auth/refresh-token'), failure),
      http.get(url('/api/menu-options/my-menu'), () => unauthorized()),
    );
    const error = await unwrap(api.GET('/api/menu-options/my-menu')).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 503 });
    expect(hooks.expired).not.toHaveBeenCalled();
  });

  it('un 401 del login no intenta renovar', async () => {
    useHooks();
    const refresh = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.post(url('/api/auth/refresh-token'), refresh),
      http.post(url('/api/auth/login'), () =>
        HttpResponse.json({ statusCode: 401, message: 'Credenciales inválidas' }, { status: 401 }),
      ),
    );
    const error = await unwrap(
      api.POST('/api/auth/login', { body: { identifier: 'a@b.co', password: 'x' } }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Credenciales inválidas');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lee el código estable del error', async () => {
    server.use(
      http.get(url('/api/menu-options/my-menu'), () =>
        HttpResponse.json(
          {
            statusCode: 403,
            message: 'Debe cambiar la contraseña',
            code: 'PASSWORD_CHANGE_REQUIRED',
          },
          { status: 403 },
        ),
      ),
    );
    await expect(unwrap(api.GET('/api/menu-options/my-menu'))).rejects.toMatchObject({
      status: 403,
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  });

  it('sin conexión lanza un error de red con mensaje claro', async () => {
    server.use(http.get(url('/api/auth/me'), () => HttpResponse.error()));
    await expect(unwrap(api.GET('/api/auth/me'))).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('No hay conexión') as string,
    });
  });
});
