import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

// Las pantallas se cargan bajo demanda (lazy): con todos los archivos en
// paralelo, la primera importación puede pasar del segundo que espera findBy.
// También el login (diferido desde la 3g-1): con la máquina cargada pasaba de 3 s.
configure({ asyncUtilTimeout: 5000 });

// jsdom no implementa matchMedia (lo usa el tema «Sistema»).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => {
  server.close();
});
