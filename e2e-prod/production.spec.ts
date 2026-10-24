import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { trackConsole } from '../e2e/checks';
import {
  COURSE_ID,
  INSTITUTION_ID,
  mockApi,
  SESSION,
  setTheme,
  STUDENT_ID,
  STUDENT_MENU,
  STUDENT_SESSION,
  SUPER_ADMIN_SESSION,
} from '../e2e/fixtures';

// El build de producción con las cabeceras reales (vite preview +
// scripts/security-headers.mjs). Cualquier bloqueo de la CSP falla la prueba.

/** Un PDF mínimo válido (el visor de Chrome lo abre). */
const PDF = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj',
  'trailer<</Root 1 0 R>>',
  '%%EOF',
].join('\n');

/** Sesión de estudiante con su menú (solo Notas y Boletines). */
async function asStudent(page: Page) {
  await mockApi(page, STUDENT_SESSION);
  await page.route('**/api/menu-options/my-menu', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUDENT_MENU),
    }),
  );
  await page.route('**/api/report-cards/*/pdf', (route) =>
    route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }),
  );
  await page.goto('/reports/report-cards');
  await expect(page.getByRole('list', { name: 'Mis boletines' })).toBeVisible();
}

/** Violaciones de la CSP en todas las pestañas del contexto (también en las blob:). */
async function trackCsp(context: BrowserContext) {
  const violations: string[] = [];
  await context.exposeBinding('__cspViolation', (_source, text: string) => {
    violations.push(text);
  });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      void (window as unknown as { __cspViolation: (t: string) => Promise<void> }).__cspViolation(
        `${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });
  // Chromium además lo anuncia en la consola («Refused to …»), incluso donde no
  // corre el script de arriba.
  const watch = (page: Page) => {
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) {
        violations.push(`console: ${message.text()}`);
      }
    });
  };
  context.pages().forEach(watch);
  context.on('page', watch);
  return violations;
}

test.describe('build de producción', () => {
  let violations: string[] = [];
  let consoleMessages: string[] = [];
  test.beforeEach(async ({ context, page }) => {
    violations = await trackCsp(context);
    consoleMessages = trackConsole(page);
  });
  test.afterEach(() => {
    expect(violations).toEqual([]);
    expect(consoleMessages).toEqual([]);
  });

  test('envía las cabeceras de seguridad y de caché', async ({ request }) => {
    for (const path of ['/', '/academic/years']) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      // Cualquier ruta de la SPA devuelve index.html.
      expect(await response.text()).toContain('<div id="root"></div>');
      const headers = response.headers();
      const csp = headers['content-security-policy'] ?? '';
      expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(headers['referrer-policy']).toBe('no-referrer');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['cache-control']).toBe('no-cache');
    }
    const html = await (await request.get('/')).text();
    const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(asset).toBeDefined();
    const response = await request.get(asset ?? '');
    expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test('el script del tema corre con la CSP (su hash coincide)', async ({ page }) => {
    await setTheme(page, 'dark');
    await mockApi(page, null);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  });

  test('recorre las pantallas principales sin bloqueos de la CSP', async ({ page }) => {
    await mockApi(page, SESSION);
    const screens = [
      '/',
      '/academic/years',
      '/academic/courses',
      `/academic/courses/${COURSE_ID}`,
      '/people/students',
      `/people/students/${STUDENT_ID}`,
      '/evaluations/evaluations',
      `/evaluations/scores?course=${COURSE_ID}`,
      `/reports/report-cards?course=${COURSE_ID}`,
      '/institution',
      '/profile',
    ];
    for (const path of screens) {
      await page.goto(path);
      // Cada pantalla carga su código diferido y pinta su título, sin error.
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText(/No encontramos esta página|No pudimos/)).toHaveCount(0);
    }
  });

  test('SUPER_ADMIN: detalle de la institución y plantillas', async ({ page }) => {
    await mockApi(page, SUPER_ADMIN_SESSION);
    await page.goto(`/admin/institutions/${INSTITUTION_ID}?tab=templates`);
    await expect(page.getByRole('list', { name: 'Plantillas' })).toBeVisible();
  });

  test('el boletín se abre en otra pestaña sin bloqueos de la CSP', async ({ page }) => {
    await asStudent(page);
    // Chromium de Playwright no tiene visor: la pestaña descarga el blob.
    const downloaded = new Promise<string>((resolve) => {
      page.context().once('page', (tab) => {
        tab.once('download', (download) => {
          resolve(download.url());
        });
      });
    });
    await page
      .getByRole('button', { name: /Descargar PDF/ })
      .first()
      .click();
    expect(await downloaded).toMatch(/^blob:/);
  });
});

test.describe('visor de PDF de Chrome', () => {
  test('@pdf-viewer el boletín se ve en el visor con la CSP de producción', async ({
    context,
    page,
  }, info) => {
    const violations = await trackCsp(context);
    await asStudent(page);
    const tabPromise = context.waitForEvent('page');
    await page
      .getByRole('button', { name: /Descargar PDF/ })
      .first()
      .click();
    const tab = await tabPromise;
    let downloaded = false;
    tab.on('download', () => {
      downloaded = true;
    });
    await expect.poll(() => tab.url()).toMatch(/^blob:/);
    // La página del visor de Chrome (su <embed> no se expone al DOM). Con
    // object-src 'none' heredado por el blob se ve igual que sin CSP (I3 de la 3f-2).
    await expect(tab.locator('body')).toHaveCSS('background-color', 'rgb(40, 40, 40)');
    await tab.waitForTimeout(2_000);
    await tab.screenshot({ path: info.outputPath('visor-pdf.png') });
    expect(downloaded).toBe(false);
    expect(violations).toEqual([]);
  });
});
