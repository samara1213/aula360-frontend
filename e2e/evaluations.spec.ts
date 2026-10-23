import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import {
  ASSIGNMENT_ID,
  EVALUATION_ID,
  mockApi,
  SESSION,
  setTheme,
  THEMES,
  VIEWPORTS,
} from './fixtures';

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`evaluaciones, ${viewport.name}, tema ${theme}`, () => {
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

      test('evaluaciones de una carga y su formulario', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto(`/evaluations/evaluations?assignment=${ASSIGNMENT_ID}`);
        await expect(page.getByRole('heading', { name: 'Evaluaciones', level: 1 })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Mis cargas' })).toBeVisible();
        await expect(page.getByRole('meter', { name: 'Porcentaje asignado' })).toBeVisible();
        await expect(
          page.getByText('Exposición', { exact: true }).filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'evaluaciones');

        await page.getByRole('button', { name: 'Nueva evaluación' }).click();
        await expect(page.getByRole('dialog', { name: 'Nueva evaluación' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({ path: info.outputPath(`nueva-${viewport.name}-${theme}.png`) });
        await page.keyboard.press('Escape');
      });

      test('planilla de notas', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto(`/evaluations/evaluations/${EVALUATION_ID}/scores`);
        await expect(page.getByRole('heading', { name: 'Taller de fracciones' })).toBeVisible();
        await expect(page.getByLabel('Nota de Mateo Rojas Castañeda')).toHaveValue('4,5');
        await check(page, info, 'planilla');

        await page.getByLabel('Nota de María José Fernández de la Hoz').fill('6');
        await page.getByLabel('Nota de Sara López').fill('3,8');
        await expect(page.getByText('Debe estar entre 1,0 y 5,0.')).toBeVisible();
        await check(page, info, 'planilla-cambios');
      });
    });
  }
}
