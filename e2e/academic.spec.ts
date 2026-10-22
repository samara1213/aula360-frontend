import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import { mockApi, SESSION, setTheme, THEMES, VIEWPORTS, YEAR_ID } from './fixtures';

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`académico, ${viewport.name}, tema ${theme}`, () => {
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

      test('años lectivos y periodos', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/academic/years');
        await expect(page.getByRole('heading', { name: 'Años lectivos' })).toBeVisible();
        await expect(
          page.getByRole('link', { name: '2026' }).filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'anios');

        await page.getByRole('button', { name: 'Nuevo año lectivo' }).click();
        await expect(page.getByRole('dialog', { name: 'Nuevo año lectivo' })).toBeVisible();
        await expectAccessible(page);
        await page.keyboard.press('Escape');

        await page.goto(`/academic/years/${YEAR_ID}`);
        await expect(page.getByRole('heading', { name: 'Año lectivo 2026' })).toBeVisible();
        await expect(
          page.getByText('Cuarto periodo (recuperaciones y cierre)').filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'anio-ficha');

        await page.goto('/academic/periods');
        await expect(page.getByLabel('Año lectivo')).toHaveValue(YEAR_ID);
        await page.getByRole('button', { name: 'Nuevo periodo' }).click();
        await expect(page.getByRole('dialog', { name: 'Nuevo periodo' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`periodo-nuevo-${viewport.name}-${theme}.png`),
        });
      });

      test('grados, materias y niveles de desempeño', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/academic/grades');
        await expect(page.getByRole('heading', { name: 'Grados' })).toBeVisible();
        await expect(page.getByText('Undécimo').filter({ visible: true })).toBeVisible();
        await check(page, info, 'grados');

        await page.goto('/academic/subjects');
        await expect(
          page.getByText('Ciencias naturales y educación ambiental').filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'materias');

        await page.goto('/academic/performance-levels');
        await expect(page.getByRole('heading', { name: 'Niveles de desempeño' })).toBeVisible();
        await expect(page.getByLabel('Desde').nth(3)).toHaveValue('4,60');
        await check(page, info, 'niveles');
      });
    });
  }
}
