import { setupServer } from 'msw/node';

/** Servidor MSW de las pruebas: cada prueba registra sus handlers con server.use(). */
export const server = setupServer();
