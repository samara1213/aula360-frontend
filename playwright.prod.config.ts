import { defineConfig, devices } from '@playwright/test';

/**
 * El build de producción (`vite preview`) con las cabeceras reales de
 * scripts/security-headers.mjs: CSP, caché y SPA. La API va simulada.
 * - chromium: el navegador de Playwright (sin visor de PDF: descarga el blob).
 * - chrome: el Chrome instalado, con su visor de PDF (solo las pruebas @pdf).
 */
export default defineConfig({
  testDir: './e2e-prod',
  outputDir: './test-results/prod',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@pdf-viewer/ },
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      grep: /@pdf-viewer/,
    },
  ],
  webServer: {
    // Siempre un build nuevo: el hash de la CSP sale de dist/index.html.
    command: 'yarn build && yarn preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
