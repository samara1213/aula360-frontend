import { QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';
import { makeSession } from '@/test/render';
import { forSameSession, safeNext, SESSION_KEY } from './session';

describe('forSameSession (M1 de 3b-1)', () => {
  const setup = () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(SESSION_KEY, makeSession());
    const store = vi.fn();
    const options = forSameSession(queryClient, store);
    const started = options.onMutate();
    return { queryClient, store, options, started };
  };

  it('guarda la respuesta si la sesión sigue siendo la misma', () => {
    const { store, options, started } = setup();
    options.onSuccess('datos', 'variables', started);
    expect(store).toHaveBeenCalledWith('datos', 'variables');
  });

  it('la descarta si mientras tanto entró otra cuenta', () => {
    const { queryClient, store, options, started } = setup();
    queryClient.setQueryData(SESSION_KEY, makeSession({ user: { id: 'otra-cuenta' } }));
    options.onSuccess('datos', 'variables', started);
    expect(store).not.toHaveBeenCalled();
  });

  it('la descarta si cambió la institución activa o se cerró la sesión', () => {
    const { queryClient, store, options, started } = setup();
    queryClient.setQueryData(SESSION_KEY, makeSession({ activeInstitutionId: 'inst-2' }));
    options.onSuccess('datos', 'variables', started);
    queryClient.setQueryData(SESSION_KEY, null);
    options.onSuccess('datos', 'variables', started);
    expect(store).not.toHaveBeenCalled();
  });
});

describe('safeNext', () => {
  it.each([
    ['/academic/periods?x=1', '/academic/periods?x=1'],
    ['/', '/'],
    [null, '/'],
    ['', '/'],
    ['https://malicioso.example', '/'],
    ['//malicioso.example', '/'],
    ['/\\malicioso.example', '/'],
    ['javascript:alert(1)', '/'],
    // El analizador de URL quita tabs y saltos: quedaría //malicioso.example (B2).
    ['/\t/malicioso.example', '/'],
    ['/\n/malicioso.example', '/'],
    ['/a/../b?x=1#y', '/b?x=1#y'],
  ])('%j → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
