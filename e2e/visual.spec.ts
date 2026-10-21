import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, SESSION, setTheme, THEMES, VIEWPORTS } from './fixtures';

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${viewport.name}, tema ${theme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

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
