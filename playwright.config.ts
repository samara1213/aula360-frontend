import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas en navegador. `e2e/visual` simula la API (no necesita backend) y
 * recorre los cuatro tamaños en los dos temas con revisión de accesibilidad.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  // El servidor de desarrollo transforma los módulos al pedirlos: con varias
  // pruebas en paralelo, la primera carga de una pantalla puede pasar de 5 s.
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'yarn dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
