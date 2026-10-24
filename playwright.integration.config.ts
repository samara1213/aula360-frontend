import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Flujos por rol contra el backend real (aula360-backend), sin API simulada.
 * Levanta el servidor de pruebas del backend (test/browser-e2e-server.ts: la
 * base de pruebas aparte, Storage y correo en memoria) y Vite en otro puerto
 * con el proxy hacia él. Necesita las variables de la base de pruebas del
 * backend (E2E_DB_MODE=isolated, DATABASE_URL_TEST y, si aplica, DB_SSL_TEST).
 * Nunca a la vez que las e2e del backend: comparten la base de pruebas.
 */
const API_PORT = 3100;
const APP_PORT = 5174;

// El servidor escribe aquí el escenario (usuarios, contraseña de la corrida,
// ids); las pruebas lo leen. Un directorio propio por corrida (los procesos de
// las pruebas heredan la variable y no crean otro); el servidor lo borra al cerrar.
process.env.BROWSER_E2E_SCENARIO ??= join(
  mkdtempSync(join(tmpdir(), 'aula360-e2e-')),
  'scenario.json',
);

export default defineConfig({
  testDir: './e2e-integration',
  outputDir: './test-results/integration',
  // Un solo escenario compartido: los flujos van en orden (el docente pone la
  // nota que después ven el estudiante y el boletín).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${String(APP_PORT)}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'yarn -s test:browser-server',
      cwd: '../aula360-backend',
      url: `http://127.0.0.1:${String(API_PORT)}/api/health`,
      env: {
        BROWSER_E2E_SCENARIO: process.env.BROWSER_E2E_SCENARIO,
        BROWSER_E2E_PORT: String(API_PORT),
        BROWSER_E2E_FRONTEND: `http://localhost:${String(APP_PORT)}`,
      },
      // Siempre uno nuevo: arma el escenario al arrancar.
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `yarn dev --port ${String(APP_PORT)}`,
      url: `http://localhost:${String(APP_PORT)}`,
      // El backend de pruebas solo escucha en 127.0.0.1.
      env: { VITE_API_TARGET: `http://127.0.0.1:${String(API_PORT)}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
