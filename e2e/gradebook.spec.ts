import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import {
  COURSE_ID,
  MENU,
  mockApi,
  SESSION,
  setTheme,
  STUDENT_ID,
  STUDENT_SESSION,
  THEMES,
  VIEWPORTS,
} from './fixtures';

const STUDENT_MENU = MENU.filter((group) => group.slug === 'evaluations').map((group) => ({
  ...group,
  children: (group.children as { slug: string }[]).filter(
    (leaf) => leaf.slug === 'evaluations.scores',
  ),
}));

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`notas, ${viewport.name}, tema ${theme}`, () => {
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

      test('cuadro de notas del curso', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto(`/evaluations/scores?course=${COURSE_ID}`);
        await expect(page.getByRole('heading', { name: 'Notas', level: 1 })).toBeVisible();
        await expect(page.getByText('Valentina Ospina').filter({ visible: true })).toBeVisible();
        await check(page, info, 'cuadro');
      });

      test('mis notas y la ficha del estudiante', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, STUDENT_SESSION);
        // Un estudiante: solo Notas en el menú y sin carga (la ruta registrada
        // después tiene prioridad).
        await page.route('**/api/menu-options/my-menu', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(STUDENT_MENU),
          }),
        );
        await page.route('**/api/teacher-assignments/mine', (route) =>
          route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
        );
        await page.goto('/evaluations/scores');
        await expect(page.getByRole('tab', { name: 'Año completo' })).toBeVisible();
        await expect(page.getByText('Ciencias sociales').filter({ visible: true })).toBeVisible();
        await check(page, info, 'mis-notas');

        await page.getByRole('tab', { name: 'Segundo periodo' }).click();
        await page.getByText('Matemáticas', { exact: true }).filter({ visible: true }).click();
        await expect(page.getByText('Exposición').filter({ visible: true })).toBeVisible();
        await check(page, info, 'mis-notas-periodo');

        await mockApi(page, SESSION);
        await page.goto(`/people/students/${STUDENT_ID}`);
        await expect(page.getByRole('region', { name: 'Notas' })).toBeVisible();
        await check(page, info, 'ficha-notas');
      });
    });
  }
}
