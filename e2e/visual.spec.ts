import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import { mockApi, SESSION, setTheme, THEMES, VIEWPORTS } from './fixtures';

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${viewport.name}, tema ${theme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      let consoleMessages: string[] = [];
      test.beforeEach(({ page }) => {
        consoleMessages = trackConsole(page);
      });
      test.afterEach(() => {
        expect(consoleMessages).toEqual([]);
      });

      test('login', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, null);
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: 'Hola de nuevo' })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`login-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
      });

      test('inicio con menú', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /Ana María/ })).toBeVisible();
        await expect(page.getByRole('link', { name: /Boletines/ }).first()).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`inicio-${viewport.name}-${theme}.png`),
          fullPage: true,
        });

        if (viewport.width < 1024) {
          await page.getByRole('button', { name: 'Abrir el menú' }).click();
          await expect(page.getByRole('dialog')).toBeVisible();
          await page.screenshot({ path: info.outputPath(`menu-${viewport.name}-${theme}.png`) });
        }
      });
    });
  }
}
