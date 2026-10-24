import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import {
  COURSE_ID,
  mockApi,
  SESSION,
  setTheme,
  STUDENT_ID,
  STUDENT_MENU,
  STUDENT_SESSION,
  THEMES,
  VIEWPORTS,
} from './fixtures';

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`boletines, ${viewport.name}, tema ${theme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      let consoleMessages: string[] = [];
      test.beforeEach(({ page }) => {
        consoleMessages = trackConsole(page);
      });
      test.afterEach(() => {
        expect(consoleMessages).toEqual([]);
      });

      /** Revisa la página y guarda su captura completa. */
      async function check(page: Page, info: TestInfo, name: string) {
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`${name}-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
      }

      test('boletines del curso y la generación masiva', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto(`/reports/report-cards?course=${COURSE_ID}`);
        await expect(page.getByRole('heading', { name: 'Boletines', level: 1 })).toBeVisible();
        await expect(
          page.getByText('Desactualizado', { exact: true }).filter({ visible: true }).first(),
        ).toBeVisible();
        await check(page, info, 'boletines');

        await page.getByRole('button', { name: 'Generar boletines del curso' }).click();
        await expect(page.getByRole('alertdialog')).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({ path: info.outputPath(`generar-${viewport.name}-${theme}.png`) });
        await page.keyboard.press('Escape');

        await page.goto(`/people/students/${STUDENT_ID}`);
        await expect(page.getByRole('region', { name: 'Boletines' })).toBeVisible();
        await check(page, info, 'ficha-boletines');
      });

      test('mis boletines', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, STUDENT_SESSION);
        await page.route('**/api/menu-options/my-menu', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(STUDENT_MENU),
          }),
        );
        await page.goto('/reports/report-cards');
        await expect(page.getByRole('list', { name: 'Mis boletines' })).toBeVisible();
        await check(page, info, 'mis-boletines');

        // El PDF llega por el backend y se abre en memoria (URL blob:), en otra pestaña.
        await page.route('**/api/report-cards/*/pdf', (route) =>
          route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 %%EOF' }),
        );
        // Chromium sin interfaz no tiene visor de PDF: la pestaña descarga el blob.
        // Se escucha antes del clic: con la respuesta simulada, la descarga es inmediata.
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
  }
}
