import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import { mockApi, SESSION, setTheme, SUPER_ADMIN_SESSION, THEMES, VIEWPORTS } from './fixtures';

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${viewport.name}, tema ${theme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      // Sin errores ni advertencias en la consola (React, React Router, Radix).
      let consoleMessages: string[] = [];
      test.beforeEach(({ page }) => {
        consoleMessages = trackConsole(page);
      });
      test.afterEach(() => {
        expect(consoleMessages).toEqual([]);
      });

      test('sedes con el diálogo de nueva sede', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/institution/campuses');
        await expect(page.getByRole('heading', { name: 'Sedes', exact: true })).toBeVisible();
        await expect(page.getByText('Sede Rural La Vega').filter({ visible: true })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`sedes-${viewport.name}-${theme}.png`),
          fullPage: true,
        });

        await page.getByRole('button', { name: 'Nueva sede' }).click();
        await expect(page.getByRole('dialog', { name: 'Nueva sede' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`sede-nueva-${viewport.name}-${theme}.png`),
        });
      });

      test('datos de la institución', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/institution');
        await expect(
          page.getByRole('heading', { name: 'Institución Educativa San José' }),
        ).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`institucion-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
      });

      test('instituciones del SUPER_ADMIN y su detalle', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SUPER_ADMIN_SESSION);
        await page.goto('/admin/institutions');
        await expect(page.getByRole('heading', { name: 'Instituciones' })).toBeVisible();
        await expect(
          page.getByText('Liceo Antiguo del Valle').filter({ visible: true }),
        ).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`instituciones-${viewport.name}-${theme}.png`),
          fullPage: true,
        });

        await page
          .getByRole('link', { name: 'Institución Educativa San José' })
          .filter({ visible: true })
          .click();
        await expect(page.getByRole('heading', { name: 'Datos generales' })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`institucion-detalle-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
      });
    });
  }
}
