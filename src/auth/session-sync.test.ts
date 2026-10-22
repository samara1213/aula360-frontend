import { QueryClient } from '@tanstack/react-query';
import { makeSession } from '@/test/render';
import { SESSION_KEY } from './session';
import { startSessionSync } from './session-sync';

describe('sincronización de la sesión (M2)', () => {
  let stop: () => void = () => undefined;
  afterEach(() => {
    stop();
  });

  function setup() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(SESSION_KEY, makeSession());
    queryClient.setQueryData(['menu', 'mine', 'inst-1'], ['datos de inst-1']);
    stop = startSessionSync(queryClient);
    return queryClient;
  }

  it('si cambia la institución activa, borra los datos guardados de la anterior', () => {
    const queryClient = setup();
    queryClient.setQueryData(SESSION_KEY, makeSession({ activeInstitutionId: 'inst-2' }));
    expect(queryClient.getQueryData(['menu', 'mine', 'inst-1'])).toBeUndefined();
  });

  it('si cambia la cuenta, también', () => {
    const queryClient = setup();
    queryClient.setQueryData(SESSION_KEY, makeSession({ user: { id: 'otro' } }));
    expect(queryClient.getQueryData(['menu', 'mine', 'inst-1'])).toBeUndefined();
  });

  it('si cambia la cuenta, borra las mutaciones terminadas y deja las que siguen en curso (B1 de la 3c)', async () => {
    const queryClient = setup();
    const cache = queryClient.getMutationCache();
    // Una edición ya terminada, con la ficha de un estudiante en su respuesta.
    const done = cache.build(queryClient, {
      mutationFn: () => Promise.resolve({ guardianName: 'Marta Rojas' }),
    });
    await done.execute(undefined);
    // Otra todavía en curso.
    let finish: (value: unknown) => void = () => undefined;
    const running = cache.build(queryClient, {
      mutationFn: () => new Promise((resolve) => (finish = resolve)),
    });
    void running.execute(undefined);
    await vi.waitFor(() => {
      expect(running.state.status).toBe('pending');
    });

    queryClient.setQueryData(SESSION_KEY, makeSession({ user: { id: 'otro' } }));
    expect(cache.getAll()).toEqual([running]);
    expect(JSON.stringify(cache.getAll().map((m) => m.state.data))).not.toContain('Marta');
    finish(null);
  });

  it('si la sesión es la misma, conserva los datos', () => {
    const queryClient = setup();
    queryClient.setQueryData(SESSION_KEY, makeSession({ user: { firstName: 'Otro nombre' } }));
    expect(queryClient.getQueryData(['menu', 'mine', 'inst-1'])).toEqual(['datos de inst-1']);
  });

  it('avisa a las demás pestañas y relee la sesión cuando otra avisa', async () => {
    const queryClient = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const other = new BroadcastChannel('aula360-session');
    const received = new Promise((resolve) => {
      other.onmessage = (event) => {
        resolve(event.data);
      };
    });

    queryClient.setQueryData(SESSION_KEY, null);
    await expect(received).resolves.toBe('changed');

    other.postMessage('changed');
    await vi.waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: SESSION_KEY });
    });
    other.close();
  });

  it('relee la sesión al volver a la pestaña', () => {
    const queryClient = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: SESSION_KEY });
  });
});
