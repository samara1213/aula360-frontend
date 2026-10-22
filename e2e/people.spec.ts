import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import { mockApi, SESSION, setTheme, STUDENT_ID, TEACHER_ID, THEMES, VIEWPORTS } from './fixtures';

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

      /** Revisa la página y guarda su captura completa. */
      async function check(page: Page, info: TestInfo, name: string) {
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`${name}-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
      }

      test('docentes: listado, alta y ficha', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/people/teachers');
        await expect(page.getByRole('heading', { name: 'Docentes', exact: true })).toBeVisible();
        await expect(
          page.getByText('Laura Cristina Gómez Restrepo').filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'docentes');

        await page.getByRole('button', { name: 'Nuevo docente' }).click();
        await expect(page.getByRole('dialog', { name: 'Nuevo docente' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`docente-nuevo-${viewport.name}-${theme}.png`),
        });
        await page.keyboard.press('Escape');

        await page.goto(`/people/teachers/${TEACHER_ID}`);
        await expect(
          page.getByRole('heading', { name: 'Laura Cristina Gómez Restrepo' }),
        ).toBeVisible();
        await expect(page.getByLabel('Especialidad (opcional)')).toHaveValue('Álgebra y geometría');
        await check(page, info, 'docente-ficha');
      });

      test('estudiantes: listado, alta y ficha', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/people/students');
        await expect(page.getByRole('heading', { name: 'Estudiantes', exact: true })).toBeVisible();
        await expect(
          page.getByText('Mateo Rojas Castañeda').filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'estudiantes');

        await page.getByRole('button', { name: 'Nuevo estudiante' }).click();
        await expect(page.getByRole('dialog', { name: 'Nuevo estudiante' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`estudiante-nuevo-${viewport.name}-${theme}.png`),
        });
        await page.keyboard.press('Escape');

        await page.goto(`/people/students/${STUDENT_ID}`);
        await expect(page.getByRole('heading', { name: 'Mateo Rojas Castañeda' })).toBeVisible();
        await expect(page.getByLabel('Nombre del acudiente (opcional)')).toHaveValue(
          'Marta Castañeda',
        );
        await check(page, info, 'estudiante-ficha');
      });
    });
  }
}
